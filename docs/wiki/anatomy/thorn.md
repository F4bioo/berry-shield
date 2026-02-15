# Berry.Thorn (Edge Guard) - Architectural Explanation

## Overview
Berry.Thorn is designed as the **environment and network guard**. It aims to monitor system boundaries, specifically targeting flagged access to environment variables and monitoring network requests.

## Logic Flow
```mermaid
graph LR
    A[Tool Call] --> B{Berry.Thorn}
    B -- Flagged Key? --> C[Scrub/Mitigate]
    B -- External URL? --> D[Verify Route]
    C --> E[Execution]
    D -- Standard --> E
```

## Why this approach?
- **Edge Monitoring**: Focuses on the boundaries to help mitigate potential secret leakage from `process.env`.
- **Interception Logic**: Wraps tool executions to provide an additional security checkpoint.

## Trade-offs
- **Filter Precision**: Policy configurations may flag legitimate development traffic or environment variables if not properly scoped.

## Related
- [API: registerBerryThorn](../reference/layers/thorn/functions/registerBerryThorn.md)
