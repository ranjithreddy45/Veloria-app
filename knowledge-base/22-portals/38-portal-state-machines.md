# 38 Portal State Machines & Lifecycle Transitions

`CODE VERIFIED`

## Public Hold State Machine

```
[INITIATED] -> (Payment Success) -> [ACTIVE_HOLD] -> (Quote Converted) -> [BOOKED]
     |                                    |
     v (Payment Failed)                   v (48 Hours Expired)
  [EXPIRED]                            [RELEASED]
```

## Vendor Assignment State Machine

```
[ASSIGNED] -> (Vendor Confirm Token) -> [CONFIRMED] -> (Service Executed) -> [COMPLETED]
     |
     v (Vendor Reject)
 [DECLINED]
```
