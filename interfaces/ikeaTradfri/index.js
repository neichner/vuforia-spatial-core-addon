/**
 * Created by Carsten on 12/06/15.
 * Modified by Peter Som de Cerff (PCS) on 12/21/15
 *
 * Copyright (c) 2015 Carsten Strunk
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
 
/*
 *  Philips Hue Interface
 *
 * This hardware interface can communicate with Philips Hue lights.
 *
 * TODO: Color support
 * TODO: Device type support
 * TODO: Rewrite to use fetch everywhere
 * TODO: Error handling
 */
 
const fetch = require('node-fetch');
const http = require('http');

const LightController = require('./LightController.js');
const SensorController = require('./SensorController.js');
const server = require('../../../../libraries/hardwareInterfaces');
const { Console } = require('winston/lib/winston/transports');
 
let settings = server.loadHardwareInterface(__dirname);
 
exports.enabled = settings('enabled');
exports.configurable = true; // can be turned on/off/adjusted from the web frontend
exports.settings = {};
 
class Light {
    constructor(index, localBridgeIP, username) {
        this.id = 'Light' + index;
        this.host = localBridgeIP;
        this.url = `/api/${username}/lights/${index}`;
        this.port = 80;
 
        this.switch = null;
        this.bri = null;
        this.colorful = false;
        this.hue = null;
        this.sat = null;
    }
}
 
function sleep(ms) {
    return new Promise((res) => {
        setTimeout(res, ms);
    });
}
 
async function getUsername(localBridgeIP) {
    let retries = 0;
    // Just retry forever
    while (true) { // eslint-disable-line
        retries += 1;
        let username = await getUsernameOnce(localBridgeIP);
        if (username) {
            return username;
        }
        if (retries < 200) {
            await sleep(2000);
        } else {
            await sleep(10000);
        }
    }
}
 
/**
 * Perform a single pairing attempt with the bridge located at localBridgeIP
 * Based on my own code from the Mozilla WebThings Philips Hue Adapter
 * @return {string?} username or undefined if pairing failed
 */
async function getUsernameOnce(localBridgeIP) {
    const res = await fetch(`http://${localBridgeIP}/api`, {
        method: 'POST',
        body: '{"devicetype":"vst#PhilipsHueInterface"}',
    });
    const reply = await res.json();
 
    if (reply.length === 0) {
        console.warn('empty response from bridge');
        return;
    }
 
    const msg = reply[0];
    if (msg.error) {
        console.warn('error from bridge', msg.error);
        return;
    }
 
    return msg.success.username;
}
 
/**
 * Attempt to automatically retrieve the local bridge IP
 */
async function getLocalBridgeIP() {
    
    var discoverGateway = tradfriLib.discoverGateway;
    const result = await discoverGateway();
    
    if (!!result === false) { // Ik weet het ook niet meer
        console.log('IKEA Tradfri: no gateway found!');
        return null;
    }
 
    console.log("IKEA Tradfri: " + result.addresses[0]);
    
    return result.addresses[0];
}
 
/**
 * Fetch and instantiate lights from a local bridge
 */
async function getLocalLights(localBridgeIP, username) {
    const res = await fetch(`http://${localBridgeIP}/api/${username}/lights`);
    const lightInfo = await res.json();
    const lights = {};
    for (let lightId in lightInfo) {
        let light = new Light(lightId, localBridgeIP, username);
        lights[light.id] = light;
    }
    return {
        lights,
        lightInfo,
    };
}
 
/**
 * Communicates with the philipsHue bridge and checks the state of the light
 * @param {Object} light the light to check
 * @param {function} callback function to run when the response has arrived
 */
function getLightState(light, callback) {
    var state;
 
    var options = {
        host: light.host,
        path: light.url,
        port: light.port,
        method: 'GET',
    };
 
    var callbackHttp = function (response) {
        var str = '';
 
        response.on('data', function (chunk) {
            str += chunk;
        });
 
        response.on('end', function () {
            //TODO add some error handling
            state = JSON.parse(str).state;
            if (!state) {
                console.error('Philips Hue Error', str);
                return;
            }
            const frameId = light.id + 'frame';
            if (state.on != light.switch) {
                light.switch = state.on;
                if (state.on) {
                    callback(light.id, frameId, 'switch', 1, 'd');
                } else {
                    callback(light.id, frameId, 'switch', 0, 'd');
                }
 
            }
 
            if (state.bri != light.bri) {
                light.bri = state.bri; // brightness is a value between 1 and 254
                callback(light.id, frameId, 'brightness', (state.bri - 1) / 253, 'f');
            }
 
            if (light.colorful) {
                if (state.hue != light.hue) {
                    light.hue = state.hue; // hue is a value between 0 and 65535
                    callback(light.id, frameId, 'hue', state.hue / 65535, 'f'); // map hue to [0,1]
                }
 
                if (state.sat != light.sat) {
                    light.sat = state.sat;
                    callback(light.id, frameId, 'saturation', state.sat / 254, 'f');
                }
            }
 
        });
    };
 
    var req = http.request(options, callbackHttp);
    req.on('error', function (e) {
        console.log('GetLightState HTTP error', e.message);
    });
    req.end();
}
 
 
/**
 * turns the specified light on or off
 * @param {number} state turns the light on if > 0.5, turns it off otherwise
 */
function writeSwitchState(light, state) {
    console.log('write switch state', light, state);
    var options = {
        host: light.host,
        path: light.url + '/state',
        port: light.port,
        method: 'PUT',
    };
 
 
    var req = http.request(options, function () { });
    req.on('error', function (e) {
        console.log('writeSwitchState HTTP error', e.message);
    });
 
    req.write(JSON.stringify({
        on: state > 0.5
    }));
 
    req.end();
 
    //TODO check for success message from the bridge
}
 
 
/**
 * Sets the brightness of the specified light
 * @param {number} bri is the brightness in the range [0,1]
 */
function writeBrightness(light, bri) {
    if (writeBrightness.requestInFlight) {
        return;
    }
 
    var options = {
        hostname: light.host,
        path: light.url + '/state',
        port: light.port,
        method: 'PUT',
    };
 
    writeBrightness.requestInFlight = true;
    var req = http.request(options, function() {
        setTimeout(function() {
            writeBrightness.requestInFlight = false;
        }, 100);
    });
    req.on('error', function (e) {
        console.log('writeBrightness HTTP error', e.message);
        setTimeout(function() {
            writeBrightness.requestInFlight = false;
        }, 100);
    });
 
    req.write(JSON.stringify({
        bri: Math.floor(bri * 253 + 1)
    }));
 
    req.end();
}
 
 
/**
 * sets the saturation for the specified light
 * @param {number} sat is the saturation in the range [0,1]
 */
function writeSaturation(light, sat) {
    var options = {
        hostname: light.host,
        path: light.url + '/state',
        port: light.port,
        method: 'PUT',
    };
 
    var req = http.request(options, function () { });
    req.on('error', function (e) {
        console.log('writeSaturation HTTP error', e.message);
    });
    req.write(JSON.stringify({
        sat: Math.floor(sat * 254),
    }));
    req.end();
}
 
 
/**
 * sets the hue for the specified light
 * @param {number} hue is the hue in the range [0,1]
 */
function writeHue(light, hue) {
    var options = {
        hostname: light.host,
        path: light.url + '/state',
        port: light.port,
        method: 'PUT',
    };
 
    var req = http.request(options, function () { });
    req.on('error', function (e) {
        console.log('writeHue HTTP error', e.message);
    });
    req.write(JSON.stringify({
        hue: Math.floor(hue * 65535),
    }));
    req.end();
}
 
if (exports.enabled) {
    server.enableDeveloperUI(true);
    let lights;
 
    /**
     * runs once, adds and clears the IO points
     */
    async function setup() {
        console.log('IKEA Tradfri: Setup...');
        
        // Reload settings
        settings = server.loadHardwareInterface(__dirname);
 
        exports.settings = {
            status: {
                type: 'status',
                connection: 'DISCOVERING TRADFRI GATEWAY',
                lights: 0,
            },
            localBridgeIP: {
                value: settings('localBridgeIP'),
                type: 'text',
                default: '',
                helpText: 'The IP address of the local IKEA Tradfri Gateway you want to connect to.',
            },
            securityCode: {
                value: settings('securityCode'),
                type: 'text',
                default: '',
                helpText: 'The local username to authenticate with the Hue Hub',
            },
            identity: {
                value: settings('identity'),
                type: 'text',
                default: '',
                helpText: 'The local username to authenticate with the Hue Hub',
            },
            psk: {
                value: settings('psk'),
                type: 'text',
                default: '',
                helpText: 'The local username to authenticate with the Hue Hub',
            }
            
        };
 
        let localBridgeIP = '';
        let securityCode = '';
        let identity = '';
        let psk = '';
        let settingsNeedUpdate = false;
        
        if (settings('localBridgeIP')) {
            localBridgeIP = settings('localBridgeIP');
        } else {
            const bridgeIP = await getLocalBridgeIP();
            exports.settings.status.connection = 'PRESS THE PAIR BUTTON ON THE IKEA TRADFRI GATEWAY';
            localBridgeIP = bridgeIP;
            exports.settings.localBridgeIP.value = localBridgeIP;
            settingsNeedUpdate = true;
        }
 
        tradfri = await new TradfriClient(localBridgeIP);
        console.log('IKEA Tradfri: Connected to tradfri:', tradfri.hostname);
 
        if (settings('identity') && settings('psk')) {
            console.log('IKEA Tradfri: Identity and psk known.');
            identity = settings('identity');
            psk = settings('psk');
        } else {
            if (!settings('securityCode')) {
                console.log('IKEA Tradfri: No security code set, unable to authenticate.');
            }
            else
            {
                securityCode = settings('securityCode');
                console.log('IKEA Tradfri: Unknown identity and PSK, using securityCode');
                const authResponse = await tradfri.authenticate(securityCode);
                console.log(authResponse);
                identity = authResponse.identity;
                psk = authResponse.psk;
                
                exports.settings.status.connection = 'PAIRED WITH IKEA TRADFRI GATEWAY';
                
                exports.settings.identity.value = identity;
                exports.settings.psk.value = psk;
                
                settingsNeedUpdate = true;
            }
        }
 
        if (settingsNeedUpdate) {
            server.setHardwareInterfaceSettings('ikeaTradfri', exports.settings, null, function(successful, error) {
                if (error) {
                    console.log('error persisting settings', error);
                }
            });
        }
    }
 
    /**
     * The main function, runs the setup and then periodically checks whether
     * the lights are on.
     */
    async function ikeaTradfriServer() { // eslint-disable-line no-inner-declarations
        console.log('Starting IKEA Tradfri');
        
        await setup();
 
        try {
            await tradfri.connect(exports.settings.identity.value, exports.settings.psk.value);
        } catch (e) {
            // handle error - see below for details
        }

        const lightControllerInstance = new LightController(tradfri, server); 
        const sensorControllerInstance = new SensorController(tradfri, server); 

        tradfri
            .on("device updated", tradfri_deviceUpdated)
            .on("device removed", tradfri_deviceRemoved)
            .observeDevices()
        ;
 
        let devices = {};
        const remotes = {};

        function tradfri_deviceUpdated(device) {
            console.log('Found device', device.name, device.instanceId);

            let isNewDevice = false;
            if (devices[device.instanceId] == undefined) {
                isNewDevice = true;
                devices[device.instanceId] = true;
            }
			switch (device.type)
			{
				case AccessoryTypes.lightbulb:
                    if(isNewDevice) 
                        lightControllerInstance.onAddDevice(device);
                    else
                        lightControllerInstance.onUpdateDevice(device);
					break;
				
				case AccessoryTypes.remote:
                case AccessoryTypes.motionSensor:
					if(isNewDevice)
                        sensorControllerInstance.onAddDevice(device);
                    else
                        sensorControllerInstance.onUpdateDevice(device);
			}            
        }
 
        function tradfri_deviceRemoved(instanceId) {
            delete devices[instanceId];
			// (object, tool)
			server.removeReadListener("IKEA_Tradfri",
            "lightbulb_" + device.instanceId);
			
			// (object, tool, node)
            server.removeNode("IKEA_Tradfri",
                "lightbulb_" + device.instanceId,
				"Lit");
				
        }
        
		/*
        setTimeout(function() {
            for(id in lightbulbs) {
                const light = lightbulbs[id].lightList[0];
                console.log(light);
                light.setBrightness(1, 5);
                light.setColor('00ff00');
                // blink
                //setTimeout(() => light.toggle(), 0);
                //setTimeout(() => light.toggle(), 10000);
                //setTimeout(() => light.toggle(), 20000);
                //setTimeout(() => light.toggle(), 30000);
            }
            
        }, 5000);
		*/
    }
 
    /**
     * @param {string} lightId
     * @param {Function} writeFn
     * @return {Function} read listener callback that invokes writeFn
     */
    function onRead(lightId, writeFn) { // eslint-disable-line no-inner-declarations
        return function(data) {
            writeFn(lights[lightId], data.value);
        };
    }
 
    var tradfriLib = require('node-tradfri-client');
    var TradfriClient = tradfriLib.TradfriClient;
    var AccessoryTypes = tradfriLib.AccessoryTypes;
    var tradfri;
    const delay = require( 'delay' );

    ikeaTradfriServer();
}