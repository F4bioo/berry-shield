# Performance & Optimization - Technical Explanation

## Overview
Berry Shield is designed to run in diverse environments, including resource-constrained hardware like the Raspberry Pi 4. The following optimizations aim to provide security while maintaining system responsiveness.

## Lazy Cloning
Deep-cloning large objects for every security check is memory-intensive. 
- **The Approach**: Berry Shield uses a "Lazy" strategy where objects are only cloned when a redaction is actually triggered. If no sensitive data is detected, the original reference is used (when safe), significantly reducing RAM allocation and GC (Garbage Collection) pressure.

## LLM Context Optimization
By cleaning and redacting large tool outputs, Berry Shield helps maintain the quality of the LLM's context window:
- **Token Efficiency**: Redacting massive JSON logs or repetitive secrets reduces the total number of tokens sent back to the model.
- **Focus**: Removing noise and sensitive metadata helps the agent focus on the relevant technical data needed for the task.

## RPi 4 Target Profile
The engine is benchmarked against Node.js runtime limitations on ARM devices. The use of efficient iterations over deep recursion in the `walk` functions is intended to prevent stack overflows and memory exhaustion on 4GB/8GB devices.

---
- [[Back to Reference]](../reference/README.md)
