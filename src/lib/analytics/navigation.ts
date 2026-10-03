export function reportPath(view:string,embedded:boolean){return embedded?`/embed/${view}`:view==='overview'?'/dashboard':`/dashboard/${view}`}
