import { MyDataView, MSJT, P_Type, sensorName, Sensor_Type, get_sensor_data } from './sensors';
import { Buffer } from 'buffer';
// import { DocumentReference } from '@angular/fire/firestore';

//* FROM COMMON ***********************
import * as util from 'util';

function addL(n, size) {
	let s = n.toString();
	let z = size - s.length;
	while (z--)
		s = '0' + s;
	return s;
}
export function getDate(dateOffset:number=0, hours:number=0){
	let now = new Date();
	// if (!date)date=now.getDate();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate()+dateOffset, hours,0,0,0);
}
export function getEpochMillis(date: Date){return Math.round(date.getTime());}
export function getEpochSeconds(date: Date){return Math.round(date.getTime()/1000);}
export function getEpochHours(date: Date){return Math.round(date.getTime()/1000/60);}
export function getYearMonthDay(t: Date) {
	return util.format('%s-%s-%s', t.getUTCFullYear(), addL(t.getUTCMonth()+1, 2), addL(t.getUTCDate(), 2));
}
// *****************************

const END_OF_NODE0 = 223;
const END_OF_NODE1 = 178;

interface Deserializable {
	deserialize(d: MyDataView);
}

function isNodeEnd(d: MyDataView): boolean {
	var is = d.d.getUint8(d.c) == END_OF_NODE0 && d.d.getUint8(d.c + 1) == END_OF_NODE1;
	if (is) d.c += 2;
	return is;
}

function getNumberArray(d: MyDataView) {
	let pins: number[] = [];
	let pinsn = d.getU8();
	for (let e = 0; e < pinsn; ++e) {
		pins.push(d.getU8());
	}
	return pins;
}
function getArray<T extends Deserializable>(d: MyDataView, type: (new () => T)): T[] {
	let array: T[] = [];
	let n = d.getU8();
	for (let e = 0; e < n; ++e) {
		let t: T = new type;
		t.deserialize(d);
		array.push(t);
	}
	return array;
}


export class SensorData implements Deserializable {
	name: string; // The name of the sensor
	s_uid: number;
	record:boolean;
	data: {}; // We put key: value
	// stype(1), typedata(dynamic, littleEndian)
	deserialize(d: MyDataView) {
		this.data = {};
		// var cc = d.c;
		var ss = d.c + d.getU8();
		var pt = d.getU8();
		this.s_uid = d.getU8();
		this.record = d.getU8() > 0;
		this.name = sensorName(pt);
		get_sensor_data(this.data, pt, d);
		if (ss != d.c) {d.c = ss; console.error("Error avoided for ${this.name} data deserialization, should check that");}
		return this;
	}
	static deserialize(d: MyDataView) { let v = new SensorData; v.deserialize(d); return v; }
	toJSON(){
		let o = {
			name:this.name, 
			s_uid:this.s_uid, 
			data:JSON.parse(JSON.stringify(this.data))
		};
		// if(o.record)delete o.record;
		return o;
	}
}

// The class for the documents in each node's collection
export class SensorsSnapshot implements Deserializable {
	data: SensorData[];
	time: number;
	// data_n(1) [data]
	deserialize(d: MyDataView) {
		this.data = getArray<SensorData>(d, SensorData);
		this.time = Math.round(Date.now());
		;
		return this;
	}
	static deserialize(d: MyDataView) { let v = new SensorsSnapshot; v.deserialize(d); return v; }
}


enum PinType { IO = 0, AnalogIN, PWM, SPI_SS };
function type_to_pins(type: number): number[] {
	switch (type) {
		case Sensor_Type.S_BATTERY: return [PinType.AnalogIN];
	}
}
// Battery, 1 pin(analog)
// Current, 1 pin(analog)
// Temperature, 1 pin(IO)


export class SensorSlot implements Deserializable {
	type: number;
	name: string;
	pins: number[]; // Will be PinType enum for the slot, a number for the pins for the actual sensor
	// constructor (name:string, pins:number[]){this.name = name, this.pins=pins;}
	// We get something like, numSlots(1), [type(1), numPins(1), [pin(1)]]
	deserialize(d: MyDataView) {
		this.type = d.getU8();
		this.name = sensorName(this.type);
		this.pins = type_to_pins(this.type);
	}
}
export class SensorSettings {
	record: boolean = true;
	poll_time: number = 1000;
	only_on_change: boolean = false;
	constructor(d: MyDataView) { this.deserialize(d); }
	deserialize(d: MyDataView) {
		
		this.record = d.getU8() > 0;
		this.poll_time = d.getU32();
		this.only_on_change = d.getU8() > 0;
	}
}
export class SensorConnected extends SensorSlot implements Deserializable {
	s_uid:number = 0;
	settings: SensorSettings;
	deserialize(d: MyDataView) { // type(1), numarray, settings(6)
		super.deserialize(d);
		this.s_uid = d.getU8();
		this.settings = new SensorSettings(d);
		this.pins = getNumberArray(d);
	}
	
}

export class NodeSettings {
	on: boolean;
}

export class DayData{
	snapshots: SensorsSnapshot[];
	date: number;
	
	constructor(n?: any) {this.set(n);}
	set(n:any){
		if(n)for (let attr in n) {
			this[attr] = n[attr];
		}
	}
	
	toPlain(){
		// let str = ;
		// console.log(str);
		// let o = ;
		// if (o.date) {o.date = this.date;}
		
		return {snapshots: JSON.parse(JSON.stringify(this.snapshots)), date:this.date}
		// return o;
		// return 
	}
}

// The class for the documents in the node collection
export class Node implements Deserializable {


	public view: {};
	public name: string;
	public uid: string;
	// public uid_string:string;
	// public get uid_string(){return this.uid.toString(16).toUpperCase();}

	public address: number;
	public get address_string() { if(this.address)return this.address.toString(8);else return '0'; }

	public sensors: SensorConnected[];				// Sensors connected
	// public board: DocumentReference;
	public pins_taken: number; 				// Pins avaiable
	public sensors_time: Date;					// Last time sensors was changed
	public sensors_available: SensorSlot[]; 	// Sensors available
	
	public snapshot: SensorsSnapshot;
	
	// public day_data: DayData[];
	// public day_data_good:boolean;

	public settings: NodeSettings;

	constructor(n?: any) {this.set(n);}
	set(n:any){
		if(n)for (let attr in n) {
			this[attr] = n[attr];
		}
	}
	
	static readonly pins: { n: number, t: PinType[], name: string }[] = [
		{ n: 0, t: [PinType.IO], name: 'J9/J3 0' },
		{ n: 1, t: [PinType.IO], name: 'J9/J3 1' },
		{ n: 2, t: [PinType.IO], name: 'J9/J3 2' },
		{ n: 3, t: [PinType.IO, PinType.PWM], name: 'J9/J3 3' },
		{ n: 4, t: [PinType.IO], name: 'J9/J3 4' },
		{ n: 8, t: [PinType.IO, PinType.SPI_SS], name: 'SPI0' },
		{ n: 9, t: [PinType.IO, PinType.SPI_SS, PinType.PWM], name: 'SPI1' },
		{ n: 10, t: [PinType.IO, PinType.SPI_SS, PinType.PWM], name: 'SPI2' },
		{ n: 14, t: [PinType.IO, PinType.AnalogIN], name: 'J1 0' },
		{ n: 15, t: [PinType.IO, PinType.AnalogIN], name: 'J1 1' },
		{ n: 16, t: [PinType.IO, PinType.AnalogIN], name: 'J1 2' },
		{ n: 17, t: [PinType.IO, PinType.AnalogIN], name: 'J1 3' },
		{ n: 18, t: [PinType.IO, PinType.AnalogIN], name: 'J1 4' },
		{ n: 19, t: [PinType.IO, PinType.AnalogIN], name: 'J1 5' },
	];
	pins_available(slot: SensorSlot) {
		let pins: { pn: string, pins: {}[] }[] = [];
		for (let pn in slot.pins) {
			let pt = slot.pins[pn];
			let pns: {}[] = [];
			for (let pin of Node.pins) {
				if (this.pin_available(pin.n) && pin.t.find(y => y == pt) != undefined) pns.push({ n: pin.n, name: pin.name });
			}
			for (let i = 0; i < 32; ++i) { }
			pins.push({ pn: pn, pins: pns });
		}
		return pins;
	}
	/**
	 * Checks if a pin is available within this node
	 * @param v Pin number
	 */
	pin_available(v: number): boolean { return ((this.pins_taken >> v) & 1) == 0; }

	deserialize(d: MyDataView) {
		// let n: Node = new Node;
		this.uid = d.getU16().toString(16).toUpperCase();
		// if(is_relay){
		// We are the relay so we need to pick what data we are being sent..
		let t = d.d.getInt8(d.c++);
		switch (t) {
			case P_Type.Data:
				this.snapshot = SensorsSnapshot.deserialize(d);
				break;
			case P_Type.Sensors_Available: // Or change sensors available
				this.sensors_available = getArray<SensorSlot>(d, SensorSlot);
				break
			case P_Type.Sensors_Connected: // Either change sensors attached
				this.pins_taken = d.getU32();
				this.sensors = getArray<SensorConnected>(d, SensorConnected);
				this.sensors_time = new Date;
				break;
			case P_Type.Initialize:
				this.address = d.getU16();
				break;
			default:
				console.log(`Type unrecognized ${t}`);
				break;
		}
	}

	is_only_data(){
		let data_keys = ['uid', 'snapshot'];
		for(let k in this){
			if(!data_keys.find(s => s == k))return false;
		}
		return true;
	}
	
	static deserialize(d: MyDataView) { let v = new Node; v.deserialize(d); return v; }
	toPlain(): {} {
		// this.snapshot.time
		let str = JSON.stringify(this);
		let o = JSON.parse(str);
		// if (o.day_data && o.day_data.time) o.day_data.time = this.day_data.date;
		if (o.sensors_time) { o.sensors_time = this.sensors_time; }
		
		// Delete the snapshots
		if (o.day_data) delete o.day_data;
		delete o.day_data_good;
		if (o.snapshot) delete o.snapshot;
		if (o.snapshots) delete o.snapshots;
		console.log(JSON.stringify(o));
		return o;
	}
}


function toArrayBuffer(buffer) {
	var ab = new ArrayBuffer(buffer.length);
	var view = new Uint8Array(ab);
	for (var i = 0; i < buffer.length; ++i) {
		view[i] = buffer[i];
	}
	return ab;
}
// Will handle message in Angular from HQ
export function handleMessage(buff: Buffer, headers: {}) {
	var d = new MyDataView(toArrayBuffer(buff));
	let n_nodes =  getArray<Node>(d, Node);
	
	return n_nodes;
}