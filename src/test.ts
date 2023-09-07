import {Schema} from "@/index";

const str = Schema.string().default('123')('456')
console.log(str)
const num = Schema.number().default(123)(456)
console.log(num)
const bool = Schema.boolean().default(false)(true)
console.log(bool)
const reg = Schema.regexp().default(/123/)()
console.log(reg)
const date = Schema.date().default(new Date())(new Date().getTime() + 1000 * 60 * 60 * 24)
console.log(date)
const percent = Schema.percent().default(0.5).step(0.1)(0.6)
console.log(percent)
const dict = Schema.dict(Schema.object({
    name: Schema.string().default('123'),
    age: Schema.number().default(123),
    performance: Schema.array(Schema.string()).default(['123']).description('爱好')
}))({
    zs: {}
})
console.log(dict)
const arr = Schema.list(Schema.object({
    name: Schema.string().default('123'),
    age: Schema.number().default(123)
}))()
console.log(arr)
const obj = Schema.object({
    name: Schema.string().default('123'),
    age: Schema.number().default(123)
})()
console.log(obj)
const tuple = Schema.tuple([
    Schema.const('123'),
    Schema.const(123)
] as const)()
console.log(tuple)
const union = Schema.union([
    Schema.string().default('123'),
    Schema.number().default(123)
] as const)()
console.log(union)
const intersect=Schema.intersect([
    Schema.const('123'),
    Schema.string(),
] as const)('123')
console.log('intersect',intersect)
const formatter = Schema.dict(
    Schema.list(
        Schema.object({
            foo: Schema.string().option(['1','3']),
            bar: Schema.list(Schema.number()).default([123]).option([
                {
                    label: '123',
                    value: 123
                }
            ])
        })
    )
)
const params = formatter({
    az: [
        {foo: '456'}
    ]
})
console.log(JSON.stringify(formatter, null, 2), params)
const json={
    type:'object',
    dict:{
        foo:{
            type:'string',
            default:'123',
        },
        bar:{
            type:'number',
            default:123
        }
    }
}
const schema=Schema.fromJSON(json)
console.log(schema({foo:'456'}))

