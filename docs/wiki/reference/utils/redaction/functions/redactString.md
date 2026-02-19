[**berry-shield**](../../../README.md)

***

# Function: redactString()

> **redactString**(`text`, `patterns`): [`RedactionResult`](../interfaces/RedactionResult.md)\<`string`\>

Defined in: [utils/redaction.ts:52](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/utils/redaction.ts#L52)

Applies redaction patterns to a string.

## Parameters

### text

`string`

The text to redact

### patterns

`SecurityPattern`[]

Security patterns to apply

## Returns

[`RedactionResult`](../interfaces/RedactionResult.md)\<`string`\>

Redaction result with stats
