# @zhinjs/schema
zhin配置声明
## 声明number
```javascript
Schema.number()
```
## 声明string
```javascript
Schema.string()
```
## 声明boolean
```javascript
Schema.boolean()
```
## 声明date
```javascript
Schema.date()
```
## 声明regexp
```javascript
Schema.regexp()
```
## 声明object
1. Record<string,string>
```javascript
Schema.dict(
    Schema.string()
)
```
2. Record<string,number>
```javascript
Schema.dict(
    Schema.number()
)
```
3. Record<string,Date>
```javascript
Schema.dict(
    Schema.date()
)
```
4. Record<string,number[]>
```javascript
Schema.dict(
    Schema.list(
        Schema.number()
    )
)
```
5. Record<string,{foo:string,bar:number[]}[]>
```javascript
Schema.dict(
    Schema.list(
        Schema.object({
            foo:Schema.string(),
            bar:Schema.list(Schema.number())
        })
    )
)
```
## 声明list
1. string[]
```javascript
Schema.list(
    Schema.string()
)
```
2. {foo:number,bar:string}[]

```javascript
Schema.list(
    Schema.object({
        foo:Schema.number(),
        bar:Schema.string()
    })
)
```
