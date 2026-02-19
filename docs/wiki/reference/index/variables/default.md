[**berry-shield**](../../README.md)

***

# Variable: default

> **default**: `object`

Defined in: [index.ts:24](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/index.ts#L24)

Berry Shield - Security architecture for OpenClaw

5-layer security architecture:
- Berry.Root: Prompt Guard (injects security policies)
- Berry.Pulp: Output Scanner (redacts detected secrets/PII)
- Berry.Thorn: Tool Blocker (mitigates flagged commands)
- Berry.Leaf: Input Audit (logs for auditing)
- Berry.Stem: Security Gate (tool-based checkpoint)

## Type Declaration

### description

> **description**: `string` = `"Security plugin designed to mitigate flagged commands and redact detected secrets/PII"`

### id

> **id**: `string` = `"berry-shield"`

### name

> **name**: `string` = `"Berry Shield"`

### version

> **version**: `string` = `VERSION`

### register()

> **register**(`api`): `void`

#### Parameters

##### api

`OpenClawPluginApi`

#### Returns

`void`
