import cap from 'cap';
import zlib from 'zlib';
import logger from './Logger.js';
import userDataManager from './UserDataManager.js';
import socket from './Socket.js';
import { config } from '../config.js';

import { PacketProcessor } from './PacketProcessor.js';
import { Lock } from '../models/Lock.js';
import { findDefaultNetworkDevice } from './NetInterfaceService.js';

const Cap = cap.Cap;
const decoders = cap.decoders;
const PROTOCOL = decoders.PROTOCOL;

const clearDataOnServerChange = () => {
    userDataManager.refreshEnemyCache();
    if (config.GLOBAL_SETTINGS.autoClearOnServerChange) {
        userDataManager.pendingClearOnNextPacket = true;
        logger.info('Server changed, clear pending on next DPS packet.');
    } else {
        logger.info('Server changed, auto-clear disabled.');
    }
};

export class PacketInterceptor {
    static start(server, port, resolve, reject) {
        server.listen(port, async () => {
            const devices = cap.deviceList();
            let num;

            console.log('Auto detecting default network interface...');
            const device_num = await findDefaultNetworkDevice(devices);
            if (device_num !== null && device_num !== undefined) {
                num = device_num;
                console.log(`Using network interface: ${num} - ${devices[num].description}`);
            } else {
                return reject(new Error('Default network interface not found!'));
            }

            if (!zlib.zstdDecompressSync) {
                const errorMsg = 'zstdDecompressSync is not available! Please update your Node.js!';
                logger.error(errorMsg);
                return reject(new Error(errorMsg));
            }

            const url = `http://localhost:${port}`;
            logger.info(`Web Server started at ${url}`);
            logger.info('WebSocket Server started');

            logger.info('Welcome!');
            logger.info('Attempting to find the game server, please wait!');

            let current_server = '';
            let _data = Buffer.alloc(0);
            let tcp_next_seq = -1;
            let tcp_cache = new Map();
            let tcp_last_time = 0;
            const tcp_lock = new Lock();

            const clearTcpCache = () => {
                _data = Buffer.alloc(0);
                tcp_next_seq = -1;
                tcp_last_time = 0;
                tcp_cache.clear();
            };

            const fragmentIpCache = new Map();
            const FRAGMENT_TIMEOUT = 30000;
            const getTCPPacket = (frameBuffer, ethOffset) => {
                const ipPacket = decoders.IPV4(frameBuffer, ethOffset);
                const ipId = ipPacket.info.id;
                if (ipPacket.info.protocol !== PROTOCOL.IP.TCP) return null;
                const isFragment = (ipPacket.info.flags & 0x1) !== 0;
                const _key = `${ipId}-${ipPacket.info.srcaddr}-${ipPacket.info.dstaddr}-${ipPacket.info.protocol}`;
                const now = Date.now();

                if (isFragment || ipPacket.info.fragoffset > 0) {
                    if (!fragmentIpCache.has(_key)) {
                        fragmentIpCache.set(_key, { fragments: [], timestamp: now });
                    }

                    const cacheEntry = fragmentIpCache.get(_key);
                    cacheEntry.fragments.push(Buffer.from(frameBuffer.subarray(ethOffset)));
                    cacheEntry.timestamp = now;

                    if (isFragment) return null;

                    const { fragments } = cacheEntry;
                    if (!fragments) {
                        logger.error(`Can't find fragments for ${_key}`);
                        return null;
                    }

                    let totalLength = 0;
                    const fragmentData = [];
                    for (const buffer of fragments) {
                        const ip = decoders.IPV4(buffer);
                        const fragmentOffset = ip.info.fragoffset * 8;
                        const payloadLength = ip.info.totallen - ip.hdrlen;
                        const payload = Buffer.from(buffer.subarray(ip.offset, ip.offset + payloadLength));
                        fragmentData.push({ offset: fragmentOffset, payload });
                        const endOffset = fragmentOffset + payloadLength;
                        if (endOffset > totalLength) totalLength = endOffset;
                    }

                    const fullPayload = Buffer.alloc(totalLength);
                    for (const fragment of fragmentData) {
                        fragment.payload.copy(fullPayload, fragment.offset);
                    }
                    fragmentIpCache.delete(_key);
                    return fullPayload;
                }
                return Buffer.from(
                    frameBuffer.subarray(ipPacket.offset, ipPacket.offset + (ipPacket.info.totallen - ipPacket.hdrlen))
                );
            };

            const c = new Cap();
            const device = devices[num].name;
            const filter = 'ip and tcp';
            const bufSize = 10 * 1024 * 1024;
            const buffer = Buffer.alloc(65535);
            const linkType = c.open(device, filter, bufSize, buffer);
            if (linkType !== 'ETHERNET') {
                logger.error('The device seems to be WRONG! Please check the device! Device type: ' + linkType);
            }
            c.setMinBytes && c.setMinBytes(0);

            const eth_queue = [];
            c.on('packet', (nbytes, truncated) => {
                // Skip truncated packets as decoding them may corrupt the TCP stream
                if (truncated) return;
                eth_queue.push(Buffer.from(buffer.subarray(0, nbytes)));
            });

            const processEthPacket = async (frameBuffer) => {
                const ethPacket = decoders.Ethernet(frameBuffer);
                if (ethPacket.info.type !== PROTOCOL.ETHERNET.IPV4) return;

                const ipPacket = decoders.IPV4(frameBuffer, ethPacket.offset);
                const { srcaddr, dstaddr } = ipPacket.info;

                const tcpBuffer = getTCPPacket(frameBuffer, ethPacket.offset);
                if (tcpBuffer === null) return;

                const tcpPacket = decoders.TCP(tcpBuffer);
                const buf = Buffer.from(tcpBuffer.subarray(tcpPacket.hdrlen));
                const { srcport, dstport } = tcpPacket.info;
                const src_server = `${srcaddr}:${srcport} -> ${dstaddr}:${dstport}`;
                const seqno = tcpPacket.info.seqno >>> 0;

                // 32-bit TCP sequence helpers (wrap-safe)
                const seqLT = (a, b) => (a - b) >>> 0 > 0x80000000;
                const seqGTE = (a, b) => !seqLT(a, b);

                await tcp_lock.acquire();
                try {
                    if (current_server !== src_server) {
                        let identified = false;
                        try {
                            // Pattern 1: Packet stream with length-prefixed chunks starting at offset 10
                            if (buf.length >= 14 && buf[4] === 0) {
                                let offset = 10;
                                while (offset + 4 <= buf.length) {
                                    const packetLength = buf.readUInt32BE(offset);
                                    if (packetLength < 4 || packetLength > 0x100000) break;
                                    if (offset + packetLength > buf.length) break;
                                    const data1 = buf.subarray(offset + 4, offset + packetLength);
                                    const signature = Buffer.from([0x00, 0x63, 0x33, 0x53, 0x42, 0x00]); // \0 c3SB \0
                                    if (
                                        data1.length >= 5 + signature.length &&
                                        Buffer.compare(data1.subarray(5, 5 + signature.length), signature) === 0
                                    ) {
                                        identified = true;
                                        break;
                                    }
                                    offset += packetLength;
                                }
                            }
                            // Pattern 2: Login return fixed packet
                            if (!identified && buf.length >= 0x62) {
                                const signature = Buffer.from([
                                    0x00, 0x00, 0x00, 0x62, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x11, 0x45, 0x14,
                                    0x00, 0x00, 0x00, 0x00, 0x0a, 0x4e, 0x08, 0x01, 0x22, 0x24,
                                ]);
                                if (
                                    Buffer.compare(buf.subarray(0, 10), signature.subarray(0, 10)) === 0 &&
                                    Buffer.compare(buf.subarray(14, 20), signature.subarray(14, 20)) === 0
                                ) {
                                    identified = true;
                                }
                            }

                            if (identified) {
                                if (current_server !== src_server) {
                                    let old_server = current_server;
                                    current_server = src_server;
                                    clearTcpCache();
                                    // Do NOT skip this packet: start assembling from this seq
                                    tcp_next_seq = seqno;
                                    clearDataOnServerChange();
                                    logger.info(
                                        'Got Scene Server Address: ' + src_server + '. Previous: ' + old_server
                                    );
                                    try {
                                        socket.emit('server_found', { src_server, timestamp: Date.now() });
                                    } catch (e) {
                                        logger.debug('Failed to emit server_found: ' + e.message);
                                    }
                                }
                            } else {
                                // Not our target server yet
                                return;
                            }
                        } catch (e) {
                            // If detection fails, skip this packet and wait for next
                            return;
                        }
                    }

                    if (tcp_next_seq === -1) {
                        // Initialize expected sequence to current if the payload looks plausible
                        if (buf.length >= 4) {
                            tcp_next_seq = seqno;
                        } else {
                            // No data payload to assemble
                            return;
                        }
                    }

                    // Cache only segments at/after the next expected sequence
                    if (buf.length > 0 && seqGTE(seqno, tcp_next_seq)) {
                        tcp_cache.set(seqno, buf);
                    }

                    while (tcp_cache.has(tcp_next_seq)) {
                        const seq = tcp_next_seq;
                        const cachedTcpData = tcp_cache.get(seq);
                        if (!cachedTcpData || cachedTcpData.length === 0) {
                            // Drop zero-length segments to avoid stalling
                            tcp_cache.delete(seq);
                            break;
                        }
                        _data = _data.length === 0 ? cachedTcpData : Buffer.concat([_data, cachedTcpData]);
                        tcp_next_seq = (seq + cachedTcpData.length) >>> 0;
                        tcp_cache.delete(seq);
                        tcp_last_time = Date.now();
                    }

                    while (_data.length > 4) {
                        const packetSize = _data.readUInt32BE();
                        if (_data.length < packetSize) break;
                        if (packetSize > 0x0fffff) {
                            logger.error(
                                `Invalid Length!! ${_data.length},${packetSize},${_data.toString('hex')},${tcp_next_seq}`
                            );
                            _data = Buffer.alloc(0);
                            break;
                        }
                        if (_data.length >= packetSize) {
                            const packet = _data.subarray(0, packetSize);
                            _data = _data.subarray(packetSize);
                            const processor = new PacketProcessor();
                            processor.processPacket(packet);
                        }
                    }
                } finally {
                    tcp_lock.release();
                }
            };

            (async () => {
                while (true) {
                    if (eth_queue.length) {
                        const pkt = eth_queue.shift();
                        await processEthPacket(pkt);
                    } else {
                        await new Promise((r) => setTimeout(r, 0));
                    }
                }
            })();

            setInterval(() => {
                const now = Date.now();
                let clearedFragments = 0;
                fragmentIpCache.forEach((cacheEntry, key) => {
                    if (now - cacheEntry.timestamp > FRAGMENT_TIMEOUT) {
                        fragmentIpCache.delete(key);
                        clearedFragments++;
                    }
                });
                if (clearedFragments > 0) {
                    logger.debug(`Cleared ${clearedFragments} expired IP fragment caches`);
                }
                if (tcp_last_time && Date.now() - tcp_last_time > FRAGMENT_TIMEOUT) {
                    logger.warn(
                        'Cannot capture the next packet! Is the game closed or disconnected? seq: ' + tcp_next_seq
                    );
                    current_server = '';
                    clearTcpCache();
                }
            }, 10000);

            resolve(url);
        });
    }
}
