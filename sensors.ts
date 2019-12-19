// Extracting straight from HQ

// The tcp/ip packets, from 0-254****************

enum MSJT{
	// From computer to HQ
	Request_Nodes=0,
	Update_Name,
	
	// From HQ to computer
	Success,
	Node_Write_Failed,
	Node_No_Response,
	Command_Not_Recognized
};

// The NRF24L01+ packet types********************************
// We have 0-127 user definable types, max size is around 120 bytes


enum P_Type{
	Data=65,
	Initialize, // 65-127 are ack messages
	Initialize_Response,
	Sensors_Connected,
	Sensors_Available,
	
	
	Request_Data,
	Bootloader,
	Add_Sensor,
	Set_Settings
};

// ADD PACKET #
enum Sensor_Type{
	S_BATTERY,
	S_TEMPERATURE,
	S_HUMIDITY,
	S_WATER,
	S_CURRENT,
	S_FREERAM,
	S_LIGHT
};

// enum NodeMSJT{
// 	Data,
// 	SensorsAvailable,
// 	Sensors	
// };

export function sensorName(type:number){
	switch(type){
		case Sensor_Type.S_BATTERY: return "battery";
		case Sensor_Type.S_TEMPERATURE: return "temperature";
		case Sensor_Type.S_LIGHT: return "light";
		case Sensor_Type.S_HUMIDITY: return "humidity";
		case Sensor_Type.S_WATER: return "water";
		case Sensor_Type.S_CURRENT: return "current";
		case Sensor_Type.S_FREERAM: return "freeram";
	}
	return "no_name";
}

class MyDataBase{
	private can_resize = true;
	littleEndian = true;
	
	d: DataView;
	c: number = 0;
	constructor(d?: ArrayBuffer | SharedArrayBuffer,bo?: number,bl?: number){
		if(d){
			this.d = new DataView(d,bo,bl);
			this.can_resize = false;
		}else {
			this.can_resize = true;
		}
	}
	resize(size:number){ // Will only increase size
		if(this.d.byteLength < size){
			let nb = new ArrayBuffer(size);
			new Uint8Array(nb).set(new Uint8Array(this.d.buffer));
			this.d = new DataView(nb);
		}
	}
}

export class MyDataView{
	littleEndian = true;
	d: DataView;
	c: number = 0;
	
	constructor(d?: ArrayBuffer | SharedArrayBuffer,offset?: number,length?: number){
		if(d)this.d = new DataView(d,offset,length);
		
	}
	
	resize(size:number){ // Will only increase size
		if(!this.d || this.d.byteLength < size){
			let nb = new ArrayBuffer(size);
			if(this.d)new Uint8Array(nb).set(new Uint8Array(this.d.buffer));
			this.d = new DataView(nb);
		}
	}
	
	left(): number {
		return this.d.byteLength - this.c;
	}
	
	// isGet(arg:any): arg is getFunc | getFuncL{return (arg is getFunc);}
	getCommon(f:(o:number,l?:boolean)=>number, s:number):number{
		if(!this.d)return 0;
		let v:number = 0;
		try{
			v = f(this.c, this.littleEndian);
		}catch (err){console.log(err);}
		this.c +=s;
		return v;
	}
	setCommon(f:(o:number,v:number,l?:boolean)=>void, s:number, v:number):void{
		this.resize(this.c + s);
		f(this.c, v, this.littleEndian);
		this.c +=s;
	}
	
	getF64(){return this.getCommon((o,l) => this.d.getFloat64(o,l),8);}
	getF32(){return this.getCommon((o,l) => this.d.getFloat32(o,l),4);}
	getU32(){return this.getCommon((o,l) => this.d.getUint32(o,l),4);}
	getU16(){return this.getCommon((o,l) => this.d.getUint16(o,l),2);}
	getU8(){return this.getCommon((o,l) => this.d.getUint8(o),1);}
	
	setF64(v:number){this.setCommon((o,v,l) => this.d.setFloat64(o,v,l),8,v)}
	setF32(v:number){this.setCommon((o,v,l) => this.d.setFloat32(o,v,l),4,v)}
	setU32(v:number){this.setCommon((o,v,l) => this.d.setUint32(o,v,l),4,v)}
	setU16(v:number){this.setCommon((o,v,l) => this.d.setUint16(o,v,l),2,v)}
	setU8(v:number){this.setCommon((o,v,l) => this.d.setUint8(o,v),1,v)}
	setAB(array:ArrayBuffer){
		this.resize(this.c + array.byteLength);
		new Uint8Array(this.d.buffer).set(new Uint8Array(array),this.c);
		this.c += array.byteLength;
	}
}

export class Board{
	name : string;
	version: number;
	pins: {};
	constructor(_n: string,_v: number,_p: {}){this.name=_n;this.version=_v;}
}
export let Boards:Board[] = [
	new Board("samn",7,{0:1,5:3})
]

export function get_sensor_data(data, type: number, d:MyDataView){
	switch (type) {
		case Sensor_Type.S_BATTERY:
			data['battery_level'] = d.getU16();
			break;
		case Sensor_Type.S_LIGHT:
			data['level'] = d.getU16();
			break;
		case Sensor_Type.S_WATER:
			data['milliLitres'] = d.getF32();
			break;
		case Sensor_Type.S_TEMPERATURE:
			data['temperature'] = d.getU16();
			break;
	}
}

// export function sensor_deserialize(d: MyDataView, node: object) {
	
// }

export { P_Type, Sensor_Type, MSJT};
