export class Schema<S = any,T=S> {
    public [Symbol.toStringTag] = 'ZhinSchema'
    constructor(
        public meta: Schema.Meta<S,T>,
        public options: Schema.Options = {},
    ) {
        const _this = this;
        const schema=function (value?:S){
            const formatter = Schema.resolve(_this.meta.type);
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
    toJSON(){
        return {
            ...this.meta,
            default:typeof this.meta.default === 'function' ? this.meta.default() : this.meta.default
        };
    }
    [Symbol.unscopables](){
        return {
            options:true,
            meta:true
        }
    }
    required(required?: boolean): this {
        this.meta.required = !!required;
        return this;
    }
    description(description: string): this {
        this.meta.description = description;
        return this;
    }
    component(component: string): this {
        this.meta.component = component;
        return this;
    }
    default(defaultValue: T extends {} ? Partial<T> : T|(()=>T)): this {
        this.meta.default = defaultValue;
        return this;
    }
    option(list: Schema.Option<T>[]): this {
        this.meta.options=Schema.formatOptionList(list)
        return this
    }
    multiple(): this {
        if(this.meta.type!=='array') throw new Error('multiple only support array type')
        this.meta.multiple=true
        return this
    }
    min(min: number): this {
        this.meta.min = min;
        return this;
    }

    max(max: number): this {
        this.meta.max = max;
        return this;
    }

    step(step: number): this {
        this.meta.step = step;
        return this;
    }

    static number(key?: string): Schema<number> {
        return new Schema<number>({ key, type: "number" });
    }

    static percent(key?: string): Schema<number> {
        return new Schema<number>({ key, type: "percent" })
            .component("slider")
            .min(0)
            .max(1)
            .step(0.01);
    }
    static string(key?: string): Schema<string> {
        return new Schema<string>({ key, type: "string" });
    }

    static boolean(key?: string): Schema<boolean> {
        return new Schema<boolean>({ key, type: "boolean" });
    }
    static regexp(key?: string) {
        return new Schema<RegExp | string,RegExp>({ key, type: "regexp" });
    }
    static date(key?: string) {
        return new Schema<Date | number,Date>({ key, type: "date" }).component("date-picker");
    }

    static dict<X extends Schema>(inner: X, key?: string) {
        return new Schema<Schema.Dict<X>>({ key: key, type: "dict" }, { inner });
    }
    static list<X extends Schema>(inner: X, key?: string) {
        return new Schema<Schema.Types<X>[]>({ key: key, type: "array" }, { inner });
    }
    static array<X extends Schema>(inner: X, key?: string) {
        return Schema.list(inner, key)
    }
    static object<X extends Schema.DictSchema>(dict: X, key?: string) {
        return new Schema<Schema.Object<X>>({ key: key, type: "object" }, { dict });
    }
    static tuple<X extends readonly any[]>(list: X, key?: string): Schema<Schema.Tuple<X>> {
        return new Schema<Schema.Tuple<X>>({ key: key, type: "tuple" }, { list });
    }
    static union<X extends readonly Schema[]>(list: X, key?: string) {
        return new Schema<Schema.Types<X[number]>>({ key: key, type: "union" }, { list });
    }
    static const<X extends string | number | boolean>(value: X, key?: string) {
        return new Schema<X>({ key: key, type: "const", default: value as any });
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
    export type Dict<T> = {
        [key:string]: Partial<Types<T>>;
    } & Record<string, any>;
    export type DictSchema = Record<string, Schema>
    export type Object<X extends DictSchema>={
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
        if(schema.meta.required && typeof value === 'undefined') throw new Error(`${schema.meta.key||'value'} is required`)
        return value;
    }
    export type Option<T=any>=T|{
        label:string
        value:T
    }
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
Schema.extend("array", function (this: Schema, value: any) {
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
module.exports=Schema
