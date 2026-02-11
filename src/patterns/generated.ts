/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * 
 * Source: Gitleaks (https://github.com/gitleaks/gitleaks)
 * License: MIT (https://github.com/gitleaks/gitleaks/blob/master/LICENSE)
 * Source URL: https://raw.githubusercontent.com/gitleaks/gitleaks/master/config/gitleaks.toml
 * Generated at: 2026-02-11T22:32:31.758Z
 * 
 * This file contains security patterns extracted from the Gitleaks project.
 * These patterns are used to detect secrets and sensitive information.
 */

export interface GeneratedPattern {
    id: string;
    description: string;
    pattern: string; // Stored as string to be re-compiled with banners
    tags: string[];
}

export const GITLEAKS_PATTERNS: GeneratedPattern[] = [
    {
        "id": "1password-secret-key",
        "description": "Uncovered a possible 1Password secret key, potentially compromising access to secrets in vaults.",
        "pattern": "\\bA3-[A-Z0-9]{6}-(?:(?:[A-Z0-9]{11})|(?:[A-Z0-9]{6}-[A-Z0-9]{5}))-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}\\b",
        "tags": []
    },
    {
        "id": "1password-service-account-token",
        "description": "Uncovered a possible 1Password service account token, potentially compromising access to secrets in vaults.",
        "pattern": "ops_eyJ[a-zA-Z0-9+/]{250,}={0,3}",
        "tags": []
    },
    {
        "id": "age-secret-key",
        "description": "Discovered a potential Age encryption tool secret key, risking data decryption and unauthorized access to sensitive information.",
        "pattern": "AGE-SECRET-KEY-1[QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L]{58}",
        "tags": []
    },
    {
        "id": "airtable-personnal-access-token",
        "description": "Uncovered a possible Airtable Personal AccessToken, potentially compromising database access and leading to data leakage or alteration.",
        "pattern": "\\b(pat[[:alnum:]]{14}\\.[a-f0-9]{64})\\b",
        "tags": []
    },
    {
        "id": "anthropic-admin-api-key",
        "description": "Detected an Anthropic Admin API Key, risking unauthorized access to administrative functions and sensitive AI model configurations.",
        "pattern": "\\b(sk-ant-admin01-[a-zA-Z0-9_\\-]{93}AA)(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "anthropic-api-key",
        "description": "Identified an Anthropic API Key, which may compromise AI assistant integrations and expose sensitive data to unauthorized access.",
        "pattern": "\\b(sk-ant-api03-[a-zA-Z0-9_\\-]{93}AA)(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "artifactory-api-key",
        "description": "Detected an Artifactory api key, posing a risk unauthorized access to the central repository.",
        "pattern": "\\bAKCp[A-Za-z0-9]{69}\\b",
        "tags": []
    },
    {
        "id": "artifactory-reference-token",
        "description": "Detected an Artifactory reference token, posing a risk of impersonation and unauthorized access to the central repository.",
        "pattern": "\\bcmVmd[A-Za-z0-9]{59}\\b",
        "tags": []
    },
    {
        "id": "aws-access-token",
        "description": "Identified a pattern that may indicate AWS credentials, risking unauthorized cloud resource access and data breaches on AWS platforms.",
        "pattern": "\\b((?:A3T[A-Z0-9]|AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16})\\b",
        "tags": []
    },
    {
        "id": "aws-amazon-bedrock-api-key-long-lived",
        "description": "Identified a pattern that may indicate long-lived Amazon Bedrock API keys, risking unauthorized Amazon Bedrock usage",
        "pattern": "\\b(ABSK[A-Za-z0-9+/]{109,269}={0,2})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "aws-amazon-bedrock-api-key-short-lived",
        "description": "Identified a pattern that may indicate short-lived Amazon Bedrock API keys, risking unauthorized Amazon Bedrock usage",
        "pattern": "bedrock-api-key-YmVkcm9jay5hbWF6b25hd3MuY29t",
        "tags": []
    },
    {
        "id": "azure-ad-client-secret",
        "description": "Azure AD Client Secret",
        "pattern": "(?:^|[\\\\'\"\\x60\\s>=:(,)])([a-zA-Z0-9_~.]{3}\\dQ~[a-zA-Z0-9_~.-]{31,34})(?:$|[\\\\'\"\\x60\\s<),])",
        "tags": []
    },
    {
        "id": "clickhouse-cloud-api-secret-key",
        "description": "Identified a pattern that may indicate clickhouse cloud API secret key, risking unauthorized clickhouse cloud api access and data breaches on ClickHouse Cloud platforms.",
        "pattern": "\\b(4b1d[A-Za-z0-9]{38})\\b",
        "tags": []
    },
    {
        "id": "cloudflare-origin-ca-key",
        "description": "Detected a Cloudflare Origin CA Key, potentially compromising cloud application deployments and operational security.",
        "pattern": "\\b(v1\\.0-[a-f0-9]{24}-[a-f0-9]{146})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "curl-auth-user",
        "description": "Discovered a potential basic authorization token provided in a curl command, which could compromise the curl accessed resource.",
        "pattern": "\\bcurl\\b(?:.*|.*(?:[\\r\\n]{1,2}.*){1,5})[ \\t\\n\\r](?:-u|--user)(?:=|[ \\t]{0,5})(\"(:[^\"]{3,}|[^:\"]{3,}:|[^:\"]{3,}:[^\"]{3,})\"|'([^:']{3,}:[^']{3,})'|((?:\"[^\"]{3,}\"|'[^']{3,}'|[\\w$@.-]+):(?:\"[^\"]{3,}\"|'[^']{3,}'|[\\w${}@.-]+)))(?:\\s|\\z)",
        "tags": []
    },
    {
        "id": "databricks-api-token",
        "description": "Uncovered a Databricks API token, which may compromise big data analytics platforms and sensitive data processing.",
        "pattern": "\\b(dapi[a-f0-9]{32}(?:-\\d)?)(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "digitalocean-access-token",
        "description": "Found a DigitalOcean OAuth Access Token, risking unauthorized cloud resource access and data compromise.",
        "pattern": "\\b(doo_v1_[a-f0-9]{64})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "digitalocean-pat",
        "description": "Discovered a DigitalOcean Personal Access Token, posing a threat to cloud infrastructure security and data privacy.",
        "pattern": "\\b(dop_v1_[a-f0-9]{64})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "flyio-access-token",
        "description": "Uncovered a Fly.io API key",
        "pattern": "\\b((?:fo1_[\\w-]{43}|fm1[ar]_[a-zA-Z0-9+\\/]{100,}={0,3}|fm2_[a-zA-Z0-9+\\/]{100,}={0,3}))(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "gcp-api-key",
        "description": "Uncovered a GCP API key, which could lead to unauthorized access to Google Cloud services and data breaches.",
        "pattern": "\\b(AIza[\\w-]{35})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "github-app-token",
        "description": "Identified a GitHub App Token, which may compromise GitHub application integrations and source code security.",
        "pattern": "(?:ghu|ghs)_[0-9a-zA-Z]{36}",
        "tags": []
    },
    {
        "id": "github-fine-grained-pat",
        "description": "Found a GitHub Fine-Grained Personal Access Token, risking unauthorized repository access and code manipulation.",
        "pattern": "github_pat_\\w{82}",
        "tags": []
    },
    {
        "id": "github-oauth",
        "description": "Discovered a GitHub OAuth Access Token, posing a risk of compromised GitHub account integrations and data leaks.",
        "pattern": "gho_[0-9a-zA-Z]{36}",
        "tags": []
    },
    {
        "id": "github-pat",
        "description": "Uncovered a GitHub Personal Access Token, potentially leading to unauthorized repository access and sensitive content exposure.",
        "pattern": "ghp_[0-9a-zA-Z]{36}",
        "tags": []
    },
    {
        "id": "github-refresh-token",
        "description": "Detected a GitHub Refresh Token, which could allow prolonged unauthorized access to GitHub services.",
        "pattern": "ghr_[0-9a-zA-Z]{36}",
        "tags": []
    },
    {
        "id": "gitlab-cicd-job-token",
        "description": "Identified a GitLab CI/CD Job Token, potential access to projects and some APIs on behalf of a user while the CI job is running.",
        "pattern": "glcbt-[0-9a-zA-Z]{1,5}_[0-9a-zA-Z_-]{20}",
        "tags": []
    },
    {
        "id": "gitlab-deploy-token",
        "description": "Identified a GitLab Deploy Token, risking access to repositories, packages and containers with write access.",
        "pattern": "gldt-[0-9a-zA-Z_\\-]{20}",
        "tags": []
    },
    {
        "id": "gitlab-feature-flag-client-token",
        "description": "Identified a GitLab feature flag client token, risks exposing user lists and features flags used by an application.",
        "pattern": "glffct-[0-9a-zA-Z_\\-]{20}",
        "tags": []
    },
    {
        "id": "gitlab-feed-token",
        "description": "Identified a GitLab feed token, risking exposure of user data.",
        "pattern": "glft-[0-9a-zA-Z_\\-]{20}",
        "tags": []
    },
    {
        "id": "gitlab-incoming-mail-token",
        "description": "Identified a GitLab incoming mail token, risking manipulation of data sent by mail.",
        "pattern": "glimt-[0-9a-zA-Z_\\-]{25}",
        "tags": []
    },
    {
        "id": "gitlab-kubernetes-agent-token",
        "description": "Identified a GitLab Kubernetes Agent token, risking access to repos and registry of projects connected via agent.",
        "pattern": "glagent-[0-9a-zA-Z_\\-]{50}",
        "tags": []
    },
    {
        "id": "gitlab-oauth-app-secret",
        "description": "Identified a GitLab OIDC Application Secret, risking access to apps using GitLab as authentication provider.",
        "pattern": "gloas-[0-9a-zA-Z_\\-]{64}",
        "tags": []
    },
    {
        "id": "gitlab-pat",
        "description": "Identified a GitLab Personal Access Token, risking unauthorized access to GitLab repositories and codebase exposure.",
        "pattern": "glpat-[\\w-]{20}",
        "tags": []
    },
    {
        "id": "gitlab-pat-routable",
        "description": "Identified a GitLab Personal Access Token (routable), risking unauthorized access to GitLab repositories and codebase exposure.",
        "pattern": "\\bglpat-[0-9a-zA-Z_-]{27,300}\\.[0-9a-z]{2}[0-9a-z]{7}\\b",
        "tags": []
    },
    {
        "id": "gitlab-ptt",
        "description": "Found a GitLab Pipeline Trigger Token, potentially compromising continuous integration workflows and project security.",
        "pattern": "glptt-[0-9a-f]{40}",
        "tags": []
    },
    {
        "id": "gitlab-rrt",
        "description": "Discovered a GitLab Runner Registration Token, posing a risk to CI/CD pipeline integrity and unauthorized access.",
        "pattern": "GR1348941[\\w-]{20}",
        "tags": []
    },
    {
        "id": "gitlab-runner-authentication-token",
        "description": "Discovered a GitLab Runner Authentication Token, posing a risk to CI/CD pipeline integrity and unauthorized access.",
        "pattern": "glrt-[0-9a-zA-Z_\\-]{20}",
        "tags": []
    },
    {
        "id": "gitlab-runner-authentication-token-routable",
        "description": "Discovered a GitLab Runner Authentication Token (Routable), posing a risk to CI/CD pipeline integrity and unauthorized access.",
        "pattern": "\\bglrt-t\\d_[0-9a-zA-Z_\\-]{27,300}\\.[0-9a-z]{2}[0-9a-z]{7}\\b",
        "tags": []
    },
    {
        "id": "gitlab-scim-token",
        "description": "Discovered a GitLab SCIM Token, posing a risk to unauthorized access for a organization or instance.",
        "pattern": "glsoat-[0-9a-zA-Z_\\-]{20}",
        "tags": []
    },
    {
        "id": "gitlab-session-cookie",
        "description": "Discovered a GitLab Session Cookie, posing a risk to unauthorized access to a user account.",
        "pattern": "_gitlab_session=[0-9a-z]{32}",
        "tags": []
    },
    {
        "id": "harness-api-key",
        "description": "Identified a Harness Access Token (PAT or SAT), risking unauthorized access to a Harness account.",
        "pattern": "(?:pat|sat)\\.[a-zA-Z0-9_-]{22}\\.[a-zA-Z0-9]{24}\\.[a-zA-Z0-9]{20}",
        "tags": []
    },
    {
        "id": "heroku-api-key-v2",
        "description": "Detected a Heroku API Key, potentially compromising cloud application deployments and operational security.",
        "pattern": "\\b((HRKU-AA[0-9a-zA-Z_-]{58}))(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "infracost-api-token",
        "description": "Detected an Infracost API Token, risking unauthorized access to cloud cost estimation tools and financial data.",
        "pattern": "\\b(ico-[a-zA-Z0-9]{32})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "jwt",
        "description": "Uncovered a JSON Web Token, which may lead to unauthorized access to web applications and sensitive user data.",
        "pattern": "\\b(ey[a-zA-Z0-9]{17,}\\.ey[a-zA-Z0-9\\/\\\\_-]{17,}\\.(?:[a-zA-Z0-9\\/\\\\_-]{10,}={0,2})?)(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "maxmind-license-key",
        "description": "Discovered a potential MaxMind license key.",
        "pattern": "\\b([A-Za-z0-9]{6}_[A-Za-z0-9]{29}_mmk)(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "microsoft-teams-webhook",
        "description": "Uncovered a Microsoft Teams Webhook, which could lead to unauthorized access to team collaboration tools and data leaks.",
        "pattern": "https://[a-z0-9]+\\.webhook\\.office\\.com/webhookb2/[a-z0-9]{8}-([a-z0-9]{4}-){3}[a-z0-9]{12}@[a-z0-9]{8}-([a-z0-9]{4}-){3}[a-z0-9]{12}/IncomingWebhook/[a-z0-9]{32}/[a-z0-9]{8}-([a-z0-9]{4}-){3}[a-z0-9]{12}",
        "tags": []
    },
    {
        "id": "notion-api-token",
        "description": "Notion API token",
        "pattern": "\\b(ntn_[0-9]{11}[A-Za-z0-9]{32}[A-Za-z0-9]{3})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "octopus-deploy-api-key",
        "description": "Discovered a potential Octopus Deploy API key, risking application deployments and operational security.",
        "pattern": "\\b(API-[A-Z0-9]{26})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "openai-api-key",
        "description": "Found an OpenAI API Key, posing a risk of unauthorized access to AI services and data manipulation.",
        "pattern": "\\b(sk-(?:proj|svcacct|admin)-(?:[A-Za-z0-9_-]{74}|[A-Za-z0-9_-]{58})T3BlbkFJ(?:[A-Za-z0-9_-]{74}|[A-Za-z0-9_-]{58})\\b|sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "openshift-user-token",
        "description": "Found an OpenShift user token, potentially compromising an OpenShift/Kubernetes cluster.",
        "pattern": "\\b(sha256~[\\w-]{43})(?:[^\\w-]|\\z)",
        "tags": []
    },
    {
        "id": "perplexity-api-key",
        "description": "Detected a Perplexity API key, which could lead to unauthorized access to Perplexity AI services and data exposure.",
        "pattern": "\\b(pplx-[a-zA-Z0-9]{48})(?:[\\x60'\"\\s;]|\\\\[nr]|$|\\b)",
        "tags": []
    },
    {
        "id": "planetscale-oauth-token",
        "description": "Found a PlanetScale OAuth token, posing a risk to database access control and sensitive data integrity.",
        "pattern": "\\b(pscale_oauth_[\\w=\\.-]{32,64})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "prefect-api-token",
        "description": "Detected a Prefect API token, risking unauthorized access to workflow management and automation services.",
        "pattern": "\\b(pnu_[a-zA-Z0-9]{36})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "pulumi-api-token",
        "description": "Found a Pulumi API token, posing a risk to infrastructure as code services and cloud resource management.",
        "pattern": "\\b(pul-[a-f0-9]{40})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "pypi-upload-token",
        "description": "Discovered a PyPI upload token, potentially compromising Python package distribution and repository integrity.",
        "pattern": "pypi-AgEIcHlwaS5vcmc[\\w-]{50,1000}",
        "tags": []
    },
    {
        "id": "readme-api-token",
        "description": "Detected a Readme API token, risking unauthorized documentation management and content exposure.",
        "pattern": "\\b(rdme_[a-z0-9]{70})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "rubygems-api-token",
        "description": "Identified a Rubygem API token, potentially compromising Ruby library distribution and package management.",
        "pattern": "\\b(rubygems_[a-f0-9]{48})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "scalingo-api-token",
        "description": "Found a Scalingo API token, posing a risk to cloud platform services and application deployment security.",
        "pattern": "\\b(tk-us-[\\w-]{48})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "sentry-org-token",
        "description": "Found a Sentry.io Organization Token, risking unauthorized access to error tracking services and sensitive application data.",
        "pattern": "\\bsntrys_eyJpYXQiO[a-zA-Z0-9+/]{10,200}(?:LCJyZWdpb25fdXJs|InJlZ2lvbl91cmwi|cmVnaW9uX3VybCI6)[a-zA-Z0-9+/]{10,200}={0,2}_[a-zA-Z0-9+/]{43}(?:[^a-zA-Z0-9+/]|\\z)",
        "tags": []
    },
    {
        "id": "sentry-user-token",
        "description": "Found a Sentry.io User Token, risking unauthorized access to error tracking services and sensitive application data.",
        "pattern": "\\b(sntryu_[a-f0-9]{64})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "settlemint-application-access-token",
        "description": "Found a Settlemint Application Access Token.",
        "pattern": "\\b(sm_aat_[a-zA-Z0-9]{16})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "settlemint-personal-access-token",
        "description": "Found a Settlemint Personal Access Token.",
        "pattern": "\\b(sm_pat_[a-zA-Z0-9]{16})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "settlemint-service-access-token",
        "description": "Found a Settlemint Service Access Token.",
        "pattern": "\\b(sm_sat_[a-zA-Z0-9]{16})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "shippo-api-token",
        "description": "Discovered a Shippo API token, potentially compromising shipping services and customer order data.",
        "pattern": "\\b(shippo_(?:live|test)_[a-fA-F0-9]{40})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "shopify-access-token",
        "description": "Uncovered a Shopify access token, which could lead to unauthorized e-commerce platform access and data breaches.",
        "pattern": "shpat_[a-fA-F0-9]{32}",
        "tags": []
    },
    {
        "id": "shopify-custom-access-token",
        "description": "Detected a Shopify custom access token, potentially compromising custom app integrations and e-commerce data security.",
        "pattern": "shpca_[a-fA-F0-9]{32}",
        "tags": []
    },
    {
        "id": "shopify-private-app-access-token",
        "description": "Identified a Shopify private app access token, risking unauthorized access to private app data and store operations.",
        "pattern": "shppa_[a-fA-F0-9]{32}",
        "tags": []
    },
    {
        "id": "shopify-shared-secret",
        "description": "Found a Shopify shared secret, posing a risk to application authentication and e-commerce platform security.",
        "pattern": "shpss_[a-fA-F0-9]{32}",
        "tags": []
    },
    {
        "id": "slack-bot-token",
        "description": "Identified a Slack Bot token, which may compromise bot integrations and communication channel security.",
        "pattern": "xoxb-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*",
        "tags": []
    },
    {
        "id": "slack-legacy-bot-token",
        "description": "Uncovered a Slack Legacy bot token, which could lead to compromised legacy bot operations and data exposure.",
        "pattern": "xoxb-[0-9]{8,14}-[a-zA-Z0-9]{18,26}",
        "tags": []
    },
    {
        "id": "slack-legacy-token",
        "description": "Detected a Slack Legacy token, risking unauthorized access to older Slack integrations and user data.",
        "pattern": "xox[os]-\\d+-\\d+-\\d+-[a-fA-F\\d]+",
        "tags": []
    },
    {
        "id": "slack-legacy-workspace-token",
        "description": "Identified a Slack Legacy Workspace token, potentially compromising access to workspace data and legacy features.",
        "pattern": "xox[ar]-(?:\\d-)?[0-9a-zA-Z]{8,48}",
        "tags": []
    },
    {
        "id": "slack-user-token",
        "description": "Found a Slack User token, posing a risk of unauthorized user impersonation and data access within Slack workspaces.",
        "pattern": "xox[pe](?:-[0-9]{10,13}){3}-[a-zA-Z0-9-]{28,34}",
        "tags": []
    },
    {
        "id": "slack-webhook-url",
        "description": "Discovered a Slack Webhook, which could lead to unauthorized message posting and data leakage in Slack channels.",
        "pattern": "(?:https?://)?hooks.slack.com/(?:services|workflows|triggers)/[A-Za-z0-9+/]{43,56}",
        "tags": []
    },
    {
        "id": "square-access-token",
        "description": "Detected a Square Access Token, risking unauthorized payment processing and financial transaction exposure.",
        "pattern": "\\b((?:EAAA|sq0atp-)[\\w-]{22,60})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "stripe-access-token",
        "description": "Found a Stripe Access Token, posing a risk to payment processing services and sensitive financial data.",
        "pattern": "\\b((?:sk|rk)_(?:test|live|prod)_[a-zA-Z0-9]{10,99})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    },
    {
        "id": "twilio-api-key",
        "description": "Found a Twilio API Key, posing a risk to communication services and sensitive customer interaction data.",
        "pattern": "SK[0-9a-fA-F]{32}",
        "tags": []
    },
    {
        "id": "vault-batch-token",
        "description": "Detected a Vault Batch Token, risking unauthorized access to secret management services and sensitive data.",
        "pattern": "\\b(hvb\\.[\\w-]{138,300})(?:[\\x60'\"\\s;]|\\\\[nr]|$)",
        "tags": []
    }
];