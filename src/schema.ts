export class Schema<T extends keyof Schema.Types=keyof Schema.Types,CD extends Schema.Children=Schema.Children>{
    private _default?:Schema.Value<T,CD>
    private _required?:boolean
    private _min?:number
    private _max?:number
    private _length?:number
    private _name?:string
    private _desc?:string
    constructor(public type:T,public children?:CD) {
    }
    default(defaultValue:Schema.Value<T,CD>){
        this._default=defaultValue
        return this
    }
    min(min:number){
        this._min=min
        return this
    }
    max(max:number){
        this._max=max
        return this
    }
    length(length:number){
        this._length=length
        return this
    }
    name(name:string){
        this._name=name
        return this
    }
    desc(desc:string){
        this._desc=desc
        return this
    }
    required(){
        this._required=true
        return this
    }
    toJSON():Schema.Rule<T,CD>{
        return Object.fromEntries(Object.entries({
            type:this.type,
            desc:this._desc,
            default:this._default,
            required:this._required,
            min:this._min,
            max:this._max,
            length:this._length,
            children:this.formatChildren()
        }).filter(([_,value])=>value!==undefined)) as any
    }
    private formatChildren(){
        if(!this.children) return undefined
        if(this.type==='object'){
            if(this.children instanceof Schema) return {
                key:'*',
                ...this.children.toJSON()
            }
            return Object.keys(this.children).map(key=>{
                return {
                    key,
                    ...this.children[key].toJSON()
                }
            })
        }
        if(this.type==='list' && this.children && this.children instanceof Schema){
            return {
                key:'*',
                ...this.children.toJSON()
            }
        }
    }
    static number(){
        return new Schema('number')
    }
    static string(){
        return new Schema('string')
    }
    static boolean(){
        return new Schema('boolean')
    }
    static date(){
        return new Schema('date')
    }
    static regexp(){
        return new Schema('regexp')
    }
    static object<R extends Schema|Schema.Dict<Schema>>(rule:R) {
        return new Schema('object',rule)
    }
    static list<R extends Schema>(rule:R){
        return new Schema('list',rule)
    }
}
export namespace Schema{
    export interface BaseTypes{
        number:number
        string:string
        boolean:boolean
        date:Date
        regexp:RegExp
    }
    export type Children=Schema|Dict<Schema>
    export type Value<T extends keyof Types,CD extends Children>= T extends keyof BaseTypes?BaseTypes[T]:T extends 'object'?ObjectValue<CD>:T extends 'list'?ArrayValue<CD>:unknown
    export type ObjectValue<CD extends Children>=CD extends Schema<infer T,infer R>?{[P:string]:Value<T,R>}:{[P in keyof CD]:Transform<CD[P]>}
    export type ArrayValue<CD extends Children>=CD extends Schema<infer P,infer R>?Value<P, R>[]:unknown
    export type Transform<S>=S extends Schema<infer T,infer R>?Value<T, R>:unknown
    export interface QuoteTypes<CT extends keyof BaseTypes=keyof BaseTypes>{
        object:Dict
        list:any[]
    }
    export type Rule<T extends keyof Types,CD extends Children>={
        type:T
        desc?:string,
        required?:boolean,
        default?:Value<T, CD>
        min?:number,
        max?:number,
        length?:number,
        children?:ChildRule<CD>
    }
    export type ChildRule<CD extends Children>=CD extends Schema<infer L,infer R>?Rule<L, R>:{[P in keyof CD]:TransformRule<CD[P]>}
    export type TransformRule<S>=S extends Schema<infer T,infer R>?Rule<T, R>:unknown
    export interface Types extends BaseTypes,QuoteTypes{}
    export type Dict<T extends any=any,K extends string|symbol=string>={
        [P in K]:T
    }
}