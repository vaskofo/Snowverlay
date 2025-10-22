class Config {
    constructor() {
        this.VERSION = '1.0.0';
        // Enable detailed debug logs and dumps to ./logs
        this.ENABLE_DEBUG_LOGS = false;
        this.IS_PAUSED = false;
        this.GLOBAL_SETTINGS = {
            autoClearOnServerChange: true,
            autoClearOnTimeout: false,
            onlyRecordEliteDummy: false,
            hideHpsBar: true,
            hideMitigationBar: false,
            windowHeightMode: 'static',
            autoPlayerCount: 8,
            staticHeightDps: 300,
            staticHeightSettings: 300,
            staticHeightSkills: 300,
            dateTimeFormat: 'YYYY-MM-DD HH:mm:ss',
            useClassColors: true,
            backgroundOpacity: 0.05,
            enableGlobalShortcuts: false,
            fontSize: 'small',
        };
    }
}

export const config = new Config();
