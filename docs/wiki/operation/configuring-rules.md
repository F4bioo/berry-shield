# How to Configure Security Rules

This guide describes the steps to add and configure security rules in Berry Shield using the command-line interface.

## Prerequisites
- Berry Shield CLI installed via OpenClaw.
- Access to the project root directory.

## Step 1: Initialize the Rule Wizard
Run the `add` command to start the interactive configuration session:

```bash
openclaw bshield add
```

## Step 2: Select a Rule Type (Preset)
The wizard provides three categories of rules:
1. **Regex Preset**: Pre-defined patterns for common sensitive data (e.g., Credit Cards, SSN).
2. **Gitleaks Integration**: Standard secret detection patterns from the Gitleaks community.
3. **Custom Rule**: Manual entry of a specific Regular Expression.

## Step 3: Define Rule Metadata
Provide the following information when prompted:
- **Rule ID**: A unique, technical identifier (e.g., `my-custom-token`).
- **Description**: A factual summary of what the rule detects.

## Step 4: Validate via Match Preview
Berry Shield executes a **Match Preview** loop before saving the rule:
1. Provide a **test string** that contains the pattern you want to detect.
2. The engine runs a simulation in a sandboxed `node:vm` environment.
3. **Result**:
   - if `Match Found`: The pattern is correctly identified.
   - if `No Match`: Adjust the regex or the test string and retry.

## Step 5: Verification
Once saved, the rule is automatically added to the internal pattern registry. Verify the inclusion by listing active rules:

```bash
openclaw bshield list
```

---
- [Back to Operation Index](README.md)
- [Back to Wiki Index](../README.md)
