class SensorController {
    constructor(tradfri, server){
        this.tradfri = tradfri;
        this.server = server;
        this.sensors = {};
        
        this.objectName = "IKEA_Tradfri";
        this.typeName = "sensor_";
        this.nodeName = "node";
        this.sensorI = 0;
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
        console.log("Adding new sensor:", device.name);
        this.sensors[device.instanceId] = device;
        this.sensors[device.instanceId].toggle = false;
        this.addNode(device.instanceId, 'sensor_' + this.sensorI++, {x: 0, y:0});
        this.addNode(device.instanceId, "Tapped", {x: 0, y:200});
        this.addNode(device.instanceId, "Toggle", {x: 0, y:-200});
    }

    async onUpdateDevice(device) {
        console.log('Sensor updated', device.name);
        this.sensors[device.instanceId].toggle = !this.sensors[device.instanceId].toggle;
        this.server.write(this.objectName, this.typeName + device.instanceId, "Toggle", this.sensors[device.instanceId].toggle ? 1 : 0, 'f');
        console.log(await this.tradfri.request('15001/'+device.instanceId, "get"));
    }
}

module.exports = SensorController;