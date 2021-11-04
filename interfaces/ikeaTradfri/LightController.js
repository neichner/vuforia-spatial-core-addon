class LightController {
    constructor(tradfri, server){
        this.tradfri = tradfri;
        this.server = server;
        this.lightbulbs = {};
        
        this.objectName = "IKEA_Tradfri";
        this.typeName = "lightbulb_";
        this.nodeName = "node";
    }

    addNode(id, name, position) {
        console.log("Added node", this.objectName, this.typeName + id, name, this.nodeName);
        this.server.addNode(this.objectName, this.typeName + id, name, this.nodeName, position);
    }

    addReadListener(device, name, callback) {
        console.log("Added read listener:", this.objectName, this.typeName + device.instanceId, name);
        this.server.addReadListener(this.objectName, this.typeName + device.instanceId, name, callback);
    }
    
    onAddDevice(device) {
        console.log("Adding new lightbulb:", device.name);
        this.lightbulbs[device.instanceId] = device;
        let currentLight = this.lightbulbs[device.instanceId].lightList[0];
        if (currentLight.isSwitchable) {
            // (object, tool, node, type, position)
            this.addNode(device.instanceId, "Lit", {x: -200, y: -200});
            this.addReadListener(device, "Lit", this.operateLight.bind(this, device));
        }
        if (currentLight.isDimmable) {
            this.addNode(device.instanceId, "Brightness", {x: 200, y: -200});
            this.addReadListener(device, "Brightness", this.setBrightness.bind(this, device));
        }
        if (currentLight.spectrum == "rgb")
        {
            this.addNode(device.instanceId, "Color", {x: -200, y: 200});
            this.addNode(device.instanceId, "Hue", {x: 0, y: 200});
            this.addNode(device.instanceId, "Saturation", {x: 200, y: 200});
            this.addReadListener(device, "Color", this.setColor.bind(this, device));
            this.addReadListener(device, "Hue", this.setHue.bind(this, device));
            this.addReadListener(device, "Saturation", this.setSaturation.bind(this, device));
        }
    }

    onUpdateDevice(device) {
        this.lightbulbs[device.instanceId] = device;
        let currentLight = this.lightbulbs[device.instanceId].lightList[0];
    }

    operateLight(device, data) {
        console.log("Operate light called", data, device.name);
        console.log("Update light status:", data.value);
        this.tradfri.operateLight(this.lightbulbs[device.instanceId], {onOff: data.value > 0.5, transitionTime:0.5}, true);
        this.tradfri.updateDevice(this.lightbulbs[device.instanceId]);
    }
    
    setBrightness(device, brightness) {
        console.log("Set brightness called", brightness, device.name);
        console.log("Update light status:", brightness);
        device.lightList[0].setBrightness(brightness.value * 100, 0.1);
    }

    setColor(device, color) {
        console.log("Set Color called", color, device.name);
        device.lightList[0].setColor(color.value);
    }

    setHue(device, hue) {
        console.log("Set hue called", hue, device.name);
        device.lightList[0].setHue(hue.value * 255);
    }

    setSaturation(device, saturation) {
        console.log("Set saturation called", saturation, device.name);
        device.lightList[0].setSaturation(saturation.value);
    }

}

module.exports = LightController;