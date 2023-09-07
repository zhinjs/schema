export class Schema<S = any,T=S> {
    public [Symbol.toStringTag] = 'ZhinSchema'
    constructor(
        public meta: Schema.Meta<S,T>,
        public options: Schema.Options = {},
    ) {
        const _this = this;
        const schema=function (value?:S){
            const formatter = Schema.resolve(_this.meta.type);
            if(!formatter) throw new Error(`type ${_this.meta.type} not found`)
            return formatter.call(_this,value);
        } as Schema<S,T>;
        return new Proxy(schema, {
            get(target, p: string | symbol, receiver: any): any {
                return Reflect.get(_this,p,receiver)
            },
            set(target, p: string | symbol, value: any, receiver: any): boolean {
                return Reflect.set(_this,p,value,receiver)
            }
        })
    }
    static fromJSON<S,T>(json:Schema.JSON<S,T>){
        const {dict,inner,list,...meta}=json
        const options:Schema.Options={}
        if(dict) options.dict=Object.fromEntries(Object.entries(dict).map(([key,value])=>[key,Schema.fromJSON(value)]))
        if(inner) options.inner=Schema.fromJSON(inner)
        if(list) options.list=list.map(item=>Schema.fromJSON(item))
        return new Schema<S,T>(meta,options)
    }
    toJSON(){
        return Object.fromEntries(Object.entries({
            ...this.meta,
            default:typeof this.meta.default === 'function' ? this.meta.default() : this.meta.default,
            inner:this.options.inner?.toJSON(),
            list:this.options.list?.map(item=>item.toJSON()),
            dict:this.options.dict?Object.fromEntries(Object.entries(this.options.dict||{}).map(([key,value])=>[key,value.toJSON()])):undefined,
        }).filter(([key,value])=>typeof value !== 'undefined'))
    }
    [Symbol.unscopables](){
        return {
            options:true,
            meta:true
        }
    }
    /** 设置是否必填 */
    required(required?: boolean): this {
        this.meta.required = !!required;
        return this;
    }
    /** 设置描述 */
    description(description: string): this {
        this.meta.description = description;
        return this;
    }
    /** 设置渲染组件 */
    component(component: string): this {
        this.meta.component = component;
        return this;
    }
    /** 设置默认值 */
    default(defaultValue: T extends {} ? Partial<T> : T|(()=>T)): this {
        this.meta.default = defaultValue;
        return this;
    }
    /** 设置选项列表 */
    option(list: Schema.Option<T>[]): this {
        this.meta.options=Schema.formatOptionList(list)
        return this
    }
    /** 设置是否允许多选 */
    multiple(): this {
        if(this.meta.type!=='list') throw new Error('multiple only support list type')
        this.meta.multiple=true
        return this
    }
    /** 设置数值最小值，类型是string时，标识最小长度 */
    min(min: number): this {
        this.meta.min = min;
        return this;
    }
    /** 设置数值最大值，类型是string时，标识最大长度 */
    max(max: number): this {
        this.meta.max = max;
        return this;
    }
    /** 设置百分比步长 */
    step(step: number): this {
        this.meta.step = step;
        return this;
    }
    /** 声明一个数字类型 */
    static number(key?: string): Schema<number> {
        return new Schema<number>({ key, type: "number" });
    }
    /** 声明一个百分比类型 */
    static percent(key?: string): Schema<number> {
        return new Schema<number>({ key, type: "percent" })
            .component("slider")
            .min(0)
            .max(1)
            .step(0.01);
    }
    /** 声明一个字符串类型 */
    static string(key?: string): Schema<string> {
        return new Schema<string>({ key, type: "string" });
    }
    /** 声明一个布尔类型 */
    static boolean(key?: string): Schema<boolean> {
        return new Schema<boolean>({ key, type: "boolean" });
    }
    /** 声明一个正则类型 */
    static regexp(key?: string) {
        return new Schema<RegExp | string,RegExp>({ key, type: "regexp" });
    }
    /** 声明一个日期类型 */
    static date(key?: string) {
        return new Schema<Date | number,Date>({ key, type: "date" }).component("date-picker");
    }
    /** 声明一个字典类型 */
    static dict<X extends Schema>(inner: X, key?: string) {
        return new Schema<Schema.Dict<X>>({ key: key, type: "dict" }, { inner });
    }
    /** 声明一个列表类型 */
    static list<X extends Schema>(inner: X, key?: string) {
        return new Schema<Schema.Types<X>[]>({ key: key, type: "list" }, { inner });
    }
    /**
     * 声明一个数组类型
     * @deprecated use list instead
     * */
    static array<X extends Schema>(inner: X, key?: string) {
        return Schema.list(inner, key)
    }
    /** 声明一个对象类型 */
    static object<X extends {}>(dict: X, key?: string) {
        return new Schema<Schema.Object<X>>({ key: key, type: "object" }, { dict });
    }
    /** 声明一个元组类型 */
    static tuple<X extends readonly any[]>(list: X, key?: string): Schema<Schema.Tuple<X>> {
        return new Schema<Schema.Tuple<X>>({ key: key, type: "tuple" }, { list });
    }
    /** 声明一个联合类型 */
    static union<X extends readonly any[]>(list: X, key?: string) {
        return new Schema<Schema.Union<X>>({ key: key, type: "union" }, { list });
    }
    /** 声明一个交叉类型 */
    static intersect<X extends readonly any[]>(list: X, key?: string) {
        return new Schema<Schema.Intersect<X>>({ key: key, type: "intersect" }, { list });
    }
    /** 声明一个常量 */
    static const<X extends string | number | boolean>(value: X, key?: string) {
        return new Schema<X>({ key: key, type: "const", default: value as any });
    }
    /** 声明一个任意类型 */
    static any(key?:string){
        return new Schema<any>({key,type:'any'})
    }
    /** 声明一个空类型 */
    static never(key?:string){
        return new Schema<never>({key,type:'never'})
    }
    static resolve<T extends string>(type: T): Schema.Formatter {
        return Schema.formatters.get(type);
    }
    static extend<T extends string>(type: T, formatter: Schema.Formatter) {
        Schema.formatters.set(type, formatter);
    }
}
export interface Schema<S = any> {
    (value?: S): S;
}
export namespace Schema {
    export const formatters: Map<string, Formatter> = new Map<string, Formatter>();
    export type Formatter<S=any,T=S> = (this: Schema, value: S) => T;
    export type JSON<S=any,T=S>= Meta<S,T> & {
        dict?:Record<string, JSON>
        inner?:JSON
        list?:JSON[]
    }
    export interface Meta<S = any,T=S> {
        key?: string;
        type?: string;
        default?: T extends {} ? Partial<T> : T|(()=>T);
        required?: boolean;
        options?: Option[];
        multiple?:boolean;
        description?: string;
        component?: string;
        min?: number;
        max?: number;
        step?: number;
    }
    export interface Options {
        dict?: Record<string, Schema>;
        inner?: Schema;
        list?: readonly Schema[];
    }
    export type Types<T> = T extends Schema<infer S,infer T> ? T : never;
    export type Union<T extends readonly any[]>= T extends readonly [infer L,...infer R]?Types<L>|Union<R>:never
    export type Intersect<T extends readonly any[]> = T extends readonly [infer L, ...infer R]?Types<L>&Intersect<R>:unknown
    export type Dict<T> = {
        [key:string]: Partial<Types<T>>;
    } & Record<string, any>;
    export type DictSchema = Record<string, Schema>
    export type Object<X extends {}>={
        [K in keyof X]?: Types<X[K]>;
    }
    export type Tuple<X extends readonly any[]> = X extends readonly [infer L, ...infer R]
        ? [Types<L>, ...Tuple<R>]
        : [];

    export function checkDefault<T>(schema: Schema, value: T,fallback:T=value) {
        const isEmpty=(value: string | object | T)=>{
            if (typeof value === "undefined") return true;
            if (typeof value === "string" && value === "") return true;
            if (typeof value === "object" && value === null) return true;
            if (Array.isArray(value) && value.length === 0) return true;
            if(value instanceof Date && isNaN(value.getTime())) return true;
            return value && typeof value === 'object' && Reflect.ownKeys(value).length === 0;

        }
        if (isEmpty(value)) {
            if (typeof schema.meta.default === "function") {
                value = schema.meta.default();
            } else {
                value = schema.meta.default||fallback;
            }
        }
        const validateType=(schema:Schema,value:any)=>{
            switch (schema.meta.type) {
                case "string":
                    if(!['string','undefined'].includes(typeof value)) throw new TypeError(`${schema.meta.key||'value'} is not a string`)
                    break;
                case "number":
                    if(!['number','undefined'].includes(typeof value)) throw new TypeError(`${schema.meta.key||'value'} is not a number`)
                    break;
                case "boolean":
                    if(!['boolean','undefined'].includes(typeof value)) throw new TypeError(`${schema.meta.key||'value'} is not a boolean`)
                    break;
                case "regexp":
                    if(!['string','undefined'].includes(typeof value) && !(value instanceof RegExp)) throw new TypeError(`${schema.meta.key||'value'} is not a RegExp|string`)
                    break;
                case "date":
                    if(!['number','undefined'].includes(typeof value) && !(value instanceof Date)) throw new TypeError(`${schema.meta.key||'value'} is not a Date|number`)
                    if(value instanceof Date && isNaN(value.getTime())) throw new TypeError(`${schema.meta.key||'value'} is not a valid Date`)
                    break;
                case "object":
                case "dict":
                    if(!['object','undefined','null'].includes(typeof value)) throw new TypeError(`${schema.meta.key||'value'} is not a object`)
                    break;
                case "array":
                case 'list':
                    if(typeof value !== 'undefined' && !Array.isArray(value)) throw new TypeError(`${schema.meta.key||'value'} is not a list`)
                    break;
                case "tuple":
                    if(typeof value !== 'undefined' && !Array.isArray(value)) throw new TypeError(`${schema.meta.key||'value'} is not a valid tuple`)
                    break;
                case "union":
                    if(typeof value !== 'undefined' && !schema.options.list?.some(item=>{
                        try{
                            item(value)
                            return true
                        }catch {
                            return false
                        }
                    })) throw new TypeError(`${schema.meta.key||'value'} is not a valid union`)
                    break;
                case "intersect":
                    if(typeof value !== 'undefined' && !schema.options.list?.every(item=>{
                        try{
                            item(value)
                            return true
                        }catch {
                            return false
                        }
                    })) throw new TypeError(`${schema.meta.key||'value'} is not a valid intersect`)
                    break;
                case "const":
                    if(typeof value !== 'undefined' && value !== schema.meta.default) throw new TypeError(`${schema.meta.key||'value'} is not const`)
                    break;
                case "percent":
                    if(typeof value !== 'undefined' && (typeof value !== 'number' || value < 0 || value > 1)) throw new TypeError(`${schema.meta.key||'value'} is not a valid percent`)
                    break;
                case "any":
                    break;
                case "never":
                    throw new TypeError(`${schema.meta.key||'value'} is never`)
                default:
                    throw new TypeError(`${schema.meta.key||'value'} is not a valid type`)
            }
        }
        if(schema.meta.required && typeof value === 'undefined') throw new Error(`${schema.meta.key||'value'} is required`)
        validateType(schema,value)
        return value;
    }
    export type Option<T=any>=T extends Array<infer R>?R|{
        label:string,
        value:R
    }:T
    export function formatOptionList<T>(list: Schema.Option<T>[]) {
        return list.map(item => {
            if (typeof item === "string") {
                return {
                    label: item,
                    value: item,
                };
            }
            return item;
        });
    }
}
Schema.extend("number", function (this: Schema, value: any) {
    value=Schema.checkDefault(this,value);
    if(this.meta.max && value>this.meta.max) throw new Error(`${this.meta.key||'value'} is too large`);
    if(this.meta.min && value<this.meta.min) throw new Error(`${this.meta.key||'value'} is too small`);
    return value;
});
Schema.extend("string", function (this: Schema, value: any) {
    value=Schema.checkDefault(this,value);
    if(this.meta.max && value?.length>this.meta.max) throw new Error(`${this.meta.key||'value'} is too long`);
    if(this.meta.min && value?.length<this.meta.min) throw new Error(`${this.meta.key||'value'} is too short`);
    return value;
});
Schema.extend("boolean", function (this: Schema, value: any) {
    return Schema.checkDefault(this,value);
});
Schema.extend("dict", function (this: Schema, value: any) {
    value=Schema.checkDefault(this,value,{});
    return Object.fromEntries(Object.entries(value).map(([key, schema]) => {
        return [key, this.options.inner(value[key])];
    }));
});
Schema.extend("list", function (this: Schema, value: any) {
    value=Schema.checkDefault(this,value,[]);
    return value.map((item: any) => this.options.inner(item));
})
Schema.extend("object", function (this: Schema, value: any) {
    value=Schema.checkDefault(this,value,{});
    return Object.fromEntries(Object.entries(this.options.dict).map(([key, schema]) => {
        return [key, schema(value[key])];
    }));
});
Schema.extend("tuple", function (this: Schema, value: any) {
    value=Schema.checkDefault(this,value,[]);
    return value.map((item: any, index: number) => this.options.list[index](item));
});
Schema.extend("union", function (this: Schema, value: any) {
    value=Schema.checkDefault(this,value,[]);
    for (const schema of this.options.list) {
        try {
            return schema(value);
        } catch (e) {}
    }
    throw new Error("union type not match");
});
Schema.extend("regexp", function (this: Schema, value: any) {
    value=Schema.checkDefault(this,value);
    if (typeof value === "string") {
        return new RegExp(value);
    }
    return value;
})
Schema.extend("intersect", function (this: Schema, value: any) {
    value=Schema.checkDefault(this,value,[]);
    for (const schema of this.options.list) {
        try {
            value = schema(value);
        } catch (e) {
            throw new Error("intersect type not match");
        }
    }
    return value;
})
Schema.extend('never',function (this: Schema, value: any) {
    throw new Error('never type not match')
})
Schema.extend("any", function (this: Schema, value: any) {
    return value;
})
Schema.extend("date", function (this: Schema, value: any) {
    value=Schema.checkDefault(this,value);
    return new Date(value);
})
Schema.extend("const", function (this: Schema, value: any) {
    value=Schema.checkDefault(this,value);
    if (value !== this.meta.default) {
        throw new Error("const value not match");
    }
    return value;
})
Schema.extend("percent", function (this: Schema, value: any) {
    value=Schema.checkDefault(this,value);
    return value;
})
