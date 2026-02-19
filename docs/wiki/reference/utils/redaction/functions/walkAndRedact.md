[**berry-shield**](../../../README.md)

***

# Function: walkAndRedact()

> **walkAndRedact**\<`T`\>(`obj`, `patterns`, `seen?`): [`RedactionResult`](../interfaces/RedactionResult.md)\<`T`\>

Defined in: [utils/redaction.ts:103](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/utils/redaction.ts#L103)

Recursively walks through an object and redacts sensitive data.
Optimized for performance and memory (Lazy Cloning).

## Type Parameters

### T

`T`

## Parameters

### obj

`T`

The object to walk and redact

### patterns

`SecurityPattern`[]

Security patterns to apply

### seen?

`WeakSet`\<`object`\> = `...`

Tracking for circular references

## Returns

[`RedactionResult`](../interfaces/RedactionResult.md)\<`T`\>

Redaction result with stats
