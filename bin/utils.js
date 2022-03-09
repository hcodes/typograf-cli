'use strict';

const program = require('commander');
const exit = require('exit');
const fs = require('fs');
const path = require('path');
const isutf8 = require('isutf8');
const lint = require('./lint');
const printError = require('./printError');
const Typograf = require('typograf');
const defaultConfig = require('../typograf.json');
const DEFAULT_USER_CONFIG = '.typograf.json';

function processText(text, prefs) {
    const isJSON = path.extname(prefs.filename.toLowerCase()) === '.json';
    const typograf = new Typograf(prefs);

    if (prefs.lint) {
        !isJSON && lint.process(text, prefs);
    } else {
        if (isJSON) {
            processJSON(text, prefs);
        } else {
            process.stdout.write(typograf.execute(text));
        }
    }
}

function processJSON(text, prefs) {
    const opts = program.opts();

    let json;
    try {
        json = JSON.parse(text);
    } catch(e) {
        printError(`${prefs.filename}: error parsing.`);
        exit(1);
    }

    const typograf = new Typograf(prefs);
    const result = JSON.stringify(json, (key, value) => {
        let needTypography = true;

        if (typeof value === 'string') {
            if (opts.onlyJsonKeys && opts.onlyJsonKeys.indexOf(key) === -1) {
                needTypography = false;
            }

            if (opts.ignoreJsonKeys && opts.ignoreJsonKeys.indexOf(key) > -1) {
                needTypography = false;
            }

            if (needTypography) {
                value = typograf.execute(value);
            }
        }

        return value;
    }, 2);

    process.stdout.write(result);
}

module.exports = {
    getDefaultConfigAsText() {
        return JSON.stringify(defaultConfig, ' ', 4);
    },

    getConfig(file) {
        let showError = true;

        if (!file) {
            file = DEFAULT_USER_CONFIG;
            showError = false;
        }

        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
            const text = fs.readFileSync(file, 'utf8');
            let config;
            try {
                config = JSON.parse(text);
            } catch(e) {
                printError(`${file}: error parsing.`);
                return null;
            }

            return config;
        } else if (showError) {
            printError(`${file}: no such file.`);
        }

        return null;
    },

    getPrefs(config) {
        const opts = program.opts();

        const prefs = {
            lint: opts.lint,
            locale: ['ru'],
            htmlEntity: {}
        };

        for (const key of ['enableRule', 'disableRule', 'locale']) {
            if (typeof opts[key] !== 'undefined') {
                prefs[key] = opts[key];
            }

            if (config && typeof config[key] !== 'undefined') {
                prefs[key] = config[key];
            }
        }

        if (typeof opts.htmlEntityType !== 'undefined') {
            prefs.htmlEntity.type = opts.htmlEntityType;
        }

        if (typeof opts.htmlEntityOnlyVisible !== 'undefined') {
            prefs.htmlEntity.onlyVisible = opts.htmlEntityOnlyVisible;
        }

        if (config && config.htmlEntity) {
            prefs.htmlEntity = Object.assign(prefs.htmlEntity, config.htmlEntity);
        }

        return prefs;
    },

    processStdin(prefs, callback) {
        let text = '';

        process.stdin
            .setEncoding('utf8')
            .on('readable', () => {
                const chunk = process.stdin.read();
                if (chunk !== null) {
                    text += chunk;
                }
            })
            .on('end', () => {
                processText(text, prefs);
                callback();
            });
    },

    processFile(prefs, callback) {
        const file = prefs.filename;

        if (fs.existsSync(file) && fs.statSync(file).isFile()) {
            const text = fs.readFileSync(file);
            if (isutf8(text)) {
                processText(text.toString(), prefs);
            } else {
                callback(true, `${file}: is not UTF-8.`);
            }
        } else {
            callback(true, `${file}: no such file.`);
        }

        callback(false);
    }
};
