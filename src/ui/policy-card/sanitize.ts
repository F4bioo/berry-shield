const POLICY_CARD_PATTERN = /<berry_shield_policy>[\s\S]*?<\/berry_shield_policy>/gi;

export interface StrippedPolicyCardResult {
    readonly content: string;
    readonly removed: boolean;
}

export function stripPolicyCards(input: string): StrippedPolicyCardResult {
    const stripped = input.replace(POLICY_CARD_PATTERN, "").trim();
    return { content: stripped, removed: stripped !== input };
}
