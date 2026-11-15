"""Do not retry uncertain external writes unless outcome is independently absent."""
def recovery_decision(execution,verification):
    if verification.status=='VERIFIED':return 'CONTINUE'
    if verification.status=='UNKNOWN':return 'ESCALATE_NO_RETRY'
    if execution.outcome=='UNCERTAIN' and verification.status=='ABSENT':return 'RETRY_SAME_IDEMPOTENCY_KEY'
    if verification.status=='ABSENT':return 'RETRY_OR_REPLAN'
    return 'ESCALATE_NO_RETRY'
