[**berry-shield**](../../../README.md)

***

# Function: findMatches()

> **findMatches**(`obj`, `patterns`, `seen?`): `string`[]

Defined in: [utils/redaction.ts:223](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/utils/redaction.ts#L223)

Efficiently finds all security patterns that match the given text or object.
Does NOT modify the input.

## Parameters

### obj

`unknown`

The object or string to check

### patterns

Security patterns or raw RegExps to search for

`SecurityPattern`[] | `RegExp`[]

### seen?

`WeakSet`\<`object`\> = `...`

## Returns

`string`[]

Array of unique pattern names that matched
