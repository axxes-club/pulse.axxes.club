export class AdmissionError extends Error {status:number;constructor(message?:string,status?:number)}
export function clientIp(headers:Pick<Headers,"get">,trusted?:string[]):string;
export function consume(query:(sql:string,args:unknown[])=>Promise<{rows:unknown[]}>,identity:string,limit?:number,seconds?:number,cost?:number,table?:string):Promise<void>;
