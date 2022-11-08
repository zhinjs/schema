export class Schema<T extends keyof Schema.Types=keyof Schema.Types,CD extends Schema.Children=Schema.Children>{
    public meta:Schema.Meta<T,CD>={}
    constructor(public type:T,public children?:CD) {
        const _this=this;
        const schema=function (data:Schema.Value<T, CD>){
            return _this.validate(data)
        } as Schema
        Object.setPrototypeOf(schema,Schema.prototype)
        return new Proxy(schema,{
            get(target: Schema, p: string | symbol, receiver: any): any {
                if(p==='constructor') return Schema.constructor
                return Reflect.get(_this,p,receiver)
            }
        }) as Schema<T,CD>
    }
    default(defaultValue:Schema.Value<T,CD>){
        this.meta.default=defaultValue
        return this
    }
    pattern(regexp:RegExp){
        this.meta.pattern=regexp
        return this
    }
    const(value:Schema.Value<T, CD>){
        this.meta.value=value
        return this
    }
    validate(data?:Schema.Value<T, CD>):Schema.Value<T, CD>{
        return Schema.resolve(data,this)[0]
    }
    min(min:number|Schema.ReturnFunc<T, CD, number>){
        this.meta.min=min
        return this
    }
    max(max:number|Schema.ReturnFunc<T, CD, number>){
        this.meta.max=max
        return this
    }
    length(length:number|Schema.ReturnFunc<T, CD, number>){
        this.meta.length=length
        return this
    }
    name(name:string|Schema.ReturnFunc<T, CD, string>){
        this.meta.name=name
        return this
    }
    desc(desc:string|Schema.ReturnFunc<T, CD, string>){
        this.meta.desc=desc
        return this
    }
    hidden(hidden:boolean|Schema.ReturnFunc<T, CD, boolean>){
        this.meta.hidden=hidden
    }
    required(required:boolean|Schema.ReturnFunc<T, CD, boolean>=true){
        this.meta.required=required
        return this
    }
    toJSON():Schema.Rule<T,CD>{
        return Object.fromEntries(Object.entries({
            ...this.meta,
            type:this.type,
            children:this.formatChildren()
        }).filter(([_,value])=>value!==undefined)) as any
    }
    private formatChildren(){
        if(!this.children) return undefined
        if(this.type==='object'){
            if(this.children instanceof Schema) return {
                '*':this.children.toJSON()
            }
            if(Array.isArray(this.children)){
                throw new Error('传入规则错误')
            }
            return Object.keys(this.children).reduce((pre,cur)=>{
                return Object.assign(pre,{[cur]:this.children[cur].toJSON()})
            },{})
        }
        if(this.type==='list'){
            if(this.children instanceof Schema) return {
                '*':this.children.toJSON()
            }
            if(Array.isArray(this.children)){
                return this.children.map((child)=>child.toJSON())
            }
            throw new Error('传入规则错误')
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
    static any(){
        return new Schema('any')
    }
    static never(){
        return new Schema('never')
    }
    static object<R extends Schema|Schema.Dict<Schema>>(rule:R) {
        return new Schema('object',rule)
    }
    static list<R extends Schema>(rule:R){
        return new Schema('list',rule)
    }
}
export interface Schema<T extends keyof Schema.Types=keyof Schema.Types,CD extends Schema.Children=Schema.Children>{
    (data?:Schema.Value<T, CD>):Schema.Value<T, CD>
    new (data?:Schema.Value<T, CD>):Schema.Value<T, CD>
}
export namespace Schema{
    export interface BaseTypes{
        number:number
        string:string
        boolean:boolean
        any:any
        never:never
        date:Date
        regexp:RegExp
    }
    const resolvers: Dict<Schema.Resolve> = {}
    export function extend(type: string, resolve:Resolve) {
        resolvers[type] = resolve
    }
    function checkWithinRange(data: number, meta: Meta, description: string) {
        let { max = Infinity, min = -Infinity } = meta
        if(typeof min==="function") min=min(data)
        if(typeof max==="function") max=max(data)
        if (data > max) throw new TypeError(`expected ${description} <= ${max} but got ${data}`)
        if (data < min) throw new TypeError(`expected ${description} >= ${min} but got ${data}`)
    }
    function property(data: any, key: string, schema: Schema) {
        const [value, adapted] = resolve(data[key], schema)
        if (!isNullable(adapted)) data[key] = adapted
        return value
    }
    extend('any',(data)=>[data])
    extend('never', (data) => {
        throw new TypeError(`expected nullable but got ${data}`)
    })
    extend('const', (data, { meta:{value} }) => {
        if (data === value) return [value]
        throw new TypeError(`expected ${value} but got ${data}`)
    })
    extend('string', (data, { meta }) => {
        if (typeof data !== 'string') throw new TypeError(`expected string but got ${data}`)
        if (meta.pattern) {
            const regexp = new RegExp(meta.pattern.source, meta.pattern.flags)
            if (!regexp.test(data)) throw new TypeError(`expect string to match regexp ${regexp}`)
        }
        checkWithinRange(data.length, meta, 'string length')
        return [data]
    })
    extend('number', (data, { meta }) => {
        if (typeof data !== 'number') throw new TypeError(`expected number but got ${data}`)
        checkWithinRange(data, meta, 'number')
        return [data]
    })
    extend('boolean', (data) => {
        if (typeof data === 'boolean') return [data]
        throw new TypeError(`expected boolean but got ${data}`)
    })
    extend('list', (data, { children, meta }) => {
        if (!Array.isArray(data)) throw new TypeError(`expected array but got ${data}`)
        checkWithinRange(data.length, meta, 'array length')
        return [data.map((item) => property(item, '*', children[0]))]
    })
    extend('object', (data, { children }) => {
        if (!isPlainObject(data)) throw new TypeError(`expected object but got ${data}`)
        const result: any = {}
        if(children instanceof Schema){
            for (const key in data) {
                result[key] = property(data, key, children)
            }
        }else{
            for (const key in children) {
                result[key] = property(data, key, children[key])
            }
        }
        return [result]
    })

    export function resolve<T extends keyof Types,CD extends Schema.Children=Schema.Children>(data:Value<T, CD>,schema?:Schema<T,CD>,strict?:boolean){
        if (!schema) return [data]

        if (isNullable(data)) {
            if (schema.meta.required || (typeof schema.meta.required==="function" && schema.meta.required(data))) throw new TypeError(`missing required value`)
            const fallback=schema.meta.default
            if (isNullable(fallback)) return [data]
            data = deepClone(fallback)
        }

        const callback = resolvers[schema.type]
        if (callback) return callback(data, schema, strict)
        throw new TypeError(`unsupported type "${schema.type}"`)
    }
    export interface Meta<T extends keyof Types=keyof Types,CD extends Children=Children>{
        default?:Value<T,CD>
        pattern?:RegExp
        required?:boolean|ReturnFunc<T,CD,boolean>
        value?:Value<T,CD>
        min?:number|ReturnFunc<T, CD, number>
        max?:number|ReturnFunc<T, CD, number>
        length?:number|ReturnFunc<T, CD, number>
        name?:string|ReturnFunc<T, CD, string>
        desc?:string|ReturnFunc<T, CD, string>
        hidden?:boolean|ReturnFunc<T, CD, boolean>
    }
    export type Resolve = (data: any, schema: Schema, strict?: boolean) => [any, any?]
    export type Children=Schema|Dict<Schema>
    export type Value<T extends keyof Types,CD extends Children>= T extends keyof BaseTypes?BaseTypes[T]:T extends 'object'?ObjectValue<CD>:T extends 'list'?ArrayValue<CD>:unknown
    export type ObjectValue<CD extends Children>=CD extends Schema<infer T,infer R>?{[P:string]:Value<T,R>}:CD extends any[]?never:{[P in keyof CD]?:Transform<CD[P]>}
    export type ArrayValue<CD extends Children>=CD extends Schema<infer P,infer R>?Value<P, R>[]:unknown
    export type Transform<S>=S extends Schema<infer T,infer R>?Value<T, R>:unknown
    export interface QuoteTypes<CT extends keyof BaseTypes=keyof BaseTypes>{
        object:Dict<BaseTypes[CT]>
        list:BaseTypes[CT][]
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
    export type ReturnFunc<T extends keyof Types,CD extends Children,R>=(source:Value<T, CD>)=>R
    export type ChildRule<CD extends Children>=CD extends Schema<infer L,infer R>?Rule<L, R>:{[P in keyof CD]:TransformRule<CD[P]>}
    export type TransformRule<S>=S extends Schema<infer T,infer R>?Rule<T, R>:unknown
    export interface Types extends BaseTypes,QuoteTypes{}
    export type Dict<T extends any=any,K extends string|symbol=string>={
        [P in K]:T
    }
    export function isNullable(value: any) {
        return value === null || value === undefined
    }
    export function isPlainObject(obj){
        return obj && obj.constructor===Object
    }
// 深拷贝
    export function deepClone(obj,cache=new WeakMap()) {
        if(obj===null) return obj
        if(obj instanceof Date) return new Date(obj)
        if(obj instanceof RegExp) return new RegExp(obj)
        if(typeof obj!=='object') return obj
        if(cache.get(obj)) return cache.get(obj)
        //判断拷贝的obj是对象还是数组
        if (Array.isArray(obj))
            return obj.map((item) => deepClone(item,cache));
        const objClone = {};
        cache.set(obj,objClone)
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (obj[key] && typeof obj[key] === "object") {
                    objClone[key] = deepClone(obj[key],cache);
                }
                else {
                    objClone[key] = obj[key];
                }
            }
        }
        return objClone;
    }
}
const Config=Schema.object({
    roles:Schema.list(Schema.object({
        id:Schema.string().desc('角色id'),
        name:Schema.string().desc('角色名'),
        permission:Schema.list(
            Schema.number().desc('权限id')
        ).desc('权限描述')
    })),
    userName:Schema.string().desc('用户名').default('111')
})
const config=new Config()
console.log(config)
console.log(Config.toJSON())