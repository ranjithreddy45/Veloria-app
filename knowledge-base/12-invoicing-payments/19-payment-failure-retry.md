# 19 - Payment Failure & Retry

---

## 🔄 Failure Recovery & Exception Alerting

- **Failed Status**: Webhook `payment.failed` marks payment row `status = FAILED`.
- **Retry Mechanism**: Customer can re-open `/pay/[token]` or invoice checkout link to attempt payment with a new order.
- **Ops Escalation**: Failures during GL posting or slot finalization call `reportSystemFailure()` to alert venue operations.
