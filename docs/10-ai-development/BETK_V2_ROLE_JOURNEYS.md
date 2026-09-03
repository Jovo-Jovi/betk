# BETK v2 — §5 ROLE JOURNEYS

> **Drop-in replacement for §5–8 of `BETK_V2_SCOPE_BASELINE.md`.**
> Collapses four disconnected flowcharts into one section with a clear hierarchy, and adds two views
> that did not previously exist: **5.3 Master Order Architecture** and **5.6 Cross-Role Lifecycle**.
>
> **Companion edit required in the parent document:** §3 (Domain model) should be reduced to its
> written *ownership rules* only. **5.3 below becomes the single canonical structural diagram** — two
> drawings of the same structure will diverge the first time something changes.
>
> **Renumbering:** merging §5–8 into §5 shifts everything below. Performance & audit → §6 ·
> Notifications → §7 · Legal → §8 · Configuration → §9 · Inventory → §10 · Disposition → §11 ·
> Gates → §12 · Open questions → §13 · Sign-off → §14.

---

## The v2 core concept

Everything in this section revolves around one structural change:

> ### One Cart → One Master Order → N Seller Orders → N Shipments

The buyer experiences a single purchase. BETK operates N independent fulfilments underneath it. Every
rule that follows — payment allocation, delivery pricing, prep deadlines, escalation, partial refunds —
exists to serve that split.

---

## 5.1 Guest Journey

**Browse → Listing → Authentication boundary**

```mermaid
flowchart TD
    G([Guest]) --> H["/ homepage<br/>collections · new arrivals · categories"]
    H --> S["/search<br/>keywords + governorate/city"]
    H --> C["/category/slug"]
    S --> L["/listing/id"]
    C --> L
    L <--> ST["/store/slug<br/>storefront"]
    L --> LEG["/legal/*<br/>terms · returns · privacy"]

    L -.add to cart.-> AUTH{{"AUTHENTICATION BOUNDARY"}}
    L -.request price.-> AUTH
    ST -.follow.-> AUTH
    AUTH --> OTP["/auth/login<br/>phone-OTP or Google"]
    OTP --> PH["verified phone required<br/>before transacting (OD-4)"]
    PH --> B([Buyer])
```

**Guest can:** browse, search, filter, view any listing or storefront, read every legal page, share a
public link.
**Guest cannot:** add to cart, request a price, follow, wishlist.

Listing detail now always shows a **fixed price**, plus weight, dimensions, specs and prep days.
Custom items additionally show a *Request price* action.

**Open — N21:** guest cart held client-side and merged at login, or login required to add.

---

## 5.2 Buyer Journey

**Discover → Quote → Cart → Checkout → Master Order → Payment → Fulfilment → Return**

```mermaid
flowchart TD
    subgraph DISCOVER["1 · DISCOVER"]
        L["/listing/id<br/>fixed price · specs · weight · prep days"]
    end

    subgraph QUOTE["2 · QUOTE — custom items only"]
        RQ["request price"] --> TH["inquiry thread"]
        TH --> Q{{"seller quotes<br/>within price .. 2x price<br/>valid 24h · includes prep time"}}
    end

    subgraph CARTP["3 · CART"]
        CP["/cart<br/>qty · remove · running totals<br/>blocked lines must be cleared"]
    end

    subgraph CHECK["4 · CHECKOUT"]
        CK["/checkout<br/>address · ONE combined delivery total<br/>subtotal + delivery = total · 50% deposit"]
    end

    subgraph ORDER["5 · MASTER ORDER"]
        SUB["master + N seller orders + items + 2N payments<br/>STOCK DECREMENTS · payment window starts"]
    end

    subgraph PAYP["6 · PAYMENT"]
        PAY["pay 50% via InstaPay to BETK"] --> UP["upload ONE proof"]
        UP --> AV{{"ADMIN verifies once"}}
    end

    subgraph FUL["7 · FULFILMENT — per seller order"]
        PRP["preparing → ready → dispatched → delivered<br/>COD balance collected at each delivery"]
    end

    subgraph RETP["8 · RETURN"]
        RET["request return · reason + evidence"] --> SR{{"seller responds"}}
        SR -->|rejected| DISP["dispute → admin decides"]
        SR -->|accepted| RF["return → refund"]
    end

    L -->|fixed price| CP
    L -->|custom item| RQ
    Q -->|buyer accepts| CP
    CP --> CK
    CK --> SUB
    SUB --> PAY
    SUB -.before upload.-> BC["buyer cancels · stock restored"]
    SUB -.window expires.-> EXP["auto-cancel · stock restored<br/>cart restored · buyer notified"]
    AV -->|rejected| RJ["cancelled · stock restored<br/>refund if taken · notified"]
    AV -->|confirmed| REL["ALL seller orders → confirmed<br/>released to sellers"]
    REL --> PRP
    PRP --> RET
```

**Buyer sees:** one master order with per-seller sections progressing independently · one combined
delivery total · both payment states per seller order · full timeline from real history rows.

**Buyer never sees:** any seller address · BETK's commission · the per-seller delivery breakdown.

**Buyer may cancel only before uploading proof.** After the deposit is confirmed the exit is
return/refund/dispute, never cancellation.

---

## 5.3 Master Order Architecture

**One Cart → One Master Order → N Seller Orders → N Shipments**

*This is the canonical structural diagram. §3 carries the written ownership rules only.*

```mermaid
flowchart TD
    CART["CART<br/>cart_items · price snapshotted at add<br/>custom lines carry inquiry_id"]
    CART ==>|checkout, one transaction| MO

    MO["MASTER ORDER — BETK-2026-000123<br/>buyer · delivery address · ONE payment proof<br/>aggregate status · combined delivery total"]

    MO --> SO1["SELLER ORDER -1<br/>store · subtotal · own delivery_fee<br/>commission snapshot · prep deadline"]
    MO --> SO2["SELLER ORDER -2"]
    MO --> SO3["SELLER ORDER -3"]

    SO1 --> I1["order_items"]
    SO1 --> P1["payments x2<br/>deposit instapay + balance cod"]
    SO1 --> SH1["shipment"]
    SO1 -.on problem.-> E1["escalation<br/>seller-reported OR SLA breach"]

    SO2 --> I2["order_items"]
    SO2 --> P2["payments x2"]
    SO2 --> SH2["shipment"]

    SO3 --> I3["order_items"]
    SO3 --> P3["payments x2"]
    SO3 --> SH3["shipment"]
```

### Ownership

| Level | Owns |
|---|---|
| **Master order** | Buyer · delivery address · the single payment proof · aggregate status · the buyer-facing combined delivery total · the order number |
| **Seller order** | Items · its own delivery fee · its commission snapshot · its prep deadline · its shipment · its two payment rows · its escalation record · its cancellation and refund |

### Why the split is load-bearing

Each seller has a different pickup origin, a different courier fee, a different prep time, a different
delivery date, and can fail independently. **A single-order model cannot express partial fulfilment**,
and partial fulfilment is the normal case in a multi-seller cart.

### What is aggregated vs itemised

| | Buyer sees | BETK stores |
|---|---|---|
| Delivery fee | One combined total | Per seller order — needed for refunds and courier reconciliation |
| Payment | One transfer, one proof, one confirmation | 2 rows per seller order (2N total) |
| Status | Master aggregate | Independent per seller order |
| Commission | Never | Per seller order, snapshotted at creation |

---

## 5.4 Seller Journey

**Onboarding → Approval → Listing → Quote → Order Released → Fulfilment → Escalation → Payout**

```mermaid
flowchart TD
    subgraph ONB["1 · ONBOARDING"]
        ON["profile · ID documents · settlement handles<br/>PICKUP ADDRESS · up to 3 categories<br/>SELLER AGREEMENT e-signature"]
        ON -->|food category selected| FOOD["FOOD BRANCH<br/>social presence URL (admin-only)<br/>packaging · label · expiry photos"]
    end

    subgraph APPR["2 · APPROVAL"]
        REV{{"ADMIN reviews"}}
        REV -->|rejected| FIX["reason shown · resubmit"]
    end

    subgraph LISTP["3 · LISTING"]
        LI["FIXED price within eligibility band<br/>weight + dimensions · specs<br/>stock · prep days ≤ 3<br/>category within approved 3"]
        PUB{{"publish gates<br/>image · title_ar · category<br/>price in band · shipping attributes<br/>settlement handle · food approval if food"}}
    end

    subgraph QT["4 · QUOTE — custom items"]
        QQ["quote within price .. 2x price<br/>valid 24h · states prep time"]
    end

    subgraph FULS["5 · FULFILMENT"]
        ORD["ORDER ARRIVES ALREADY COMMITTED<br/>no acceptance step"]
        ORD --> PRE["preparing"] --> RDY["ready"] --> PICK["courier collects"]
    end

    subgraph ESCS["6 · ESCALATION — the only exit"]
        RP["report a problem<br/>out of stock · damaged · cannot fulfil"]
        AUTO["deadline breached → auto-escalation"]
    end

    subgraph PAYS["7 · PAYOUT"]
        EARN["derived balance<br/>subtotal − commission<br/>past return-hold window"] --> PO["request payout"]
    end

    ON --> REV
    FOOD --> REV
    FIX --> ON
    REV -->|approved| LI
    LI --> PUB --> LIVE["listing active"]
    LIVE --> QQ
    LIVE --> ORD
    ORD -.cannot fulfil.-> RP
    ORD -.SLA.-> AUTO
    PICK --> EARN
```

### What the seller sees on an order

**Sees:** order reference · items and quantities · prep deadline.
**Never sees:** buyer name · phone · address · the buyer's other seller orders.

Questions go through the in-app order thread under a neutral label. BETK generates the courier's
label; the seller labels the box with the order reference only.

### Prep SLA

Deadline = `confirmed_at + MAX(prep_days)` across that seller order's items — max, not sum, because a
seller prepares in parallel.

| Elapsed | Action |
|---|---|
| On release | Notify: order ref, item count, ready-by date |
| 50% | Reminder |
| 80%, not yet ready | Urgent reminder |
| **Breach** | **Auto-escalation** → admin queue + buyer notified of the delay |

Custom items are exempt from the 3-day cap — their prep time comes from the accepted quote.

### What the seller may not do

Cancel an order · sell outside the approved 3 categories · publish food without food approval · quote
outside the tolerance band · see any buyer identity or address.

---

## 5.5 Admin Operations Journey

**Seller Approval → Payment Verification → Courier Handoff → Escalations → Returns → Payouts**

```mermaid
flowchart TD
    A([Admin])

    A --> Q1["1 · SELLER APPROVALS<br/>identity · categories · agreement<br/>+ food verification review"]
    A --> Q2["2 · PAYMENT VERIFICATION<br/>proof via signed URL<br/>ONE action confirms ALL deposit rows<br/>under that master order"]
    Q2 -->|rejected| RJ["cancel · restore stock · refund · notify"]
    Q2 -->|confirmed| REL["release all seller orders"]

    A --> Q3["3 · READY-FOR-PICKUP QUEUE<br/>seller orders awaiting collection<br/>hand off to courier — API or manual"]
    A --> Q4["4 · ESCALATIONS<br/>seller-reported + SLA breaches"]
    Q4 --> R1["cancel + refund + stock rule"]
    Q4 --> R2["reinstate with new deadline"]
    Q4 --> R3["cancel + strike"]

    A --> Q5["5 · RETURNS & DISPUTES<br/>evidence review · final decision"]
    Q5 --> RF["refund — full or partial per seller order"]

    A --> Q6["6 · PAYOUTS<br/>derived balances · manual settlement"]
    A --> Q7["SELLER PERFORMANCE AUDIT<br/>stock accuracy leads"]
    A --> Q8["CONFIGURATION<br/>price band · commission · tolerance<br/>windows · prep cap · courier matrix"]
    A --> Q9["MODERATION · strikes · categories"]
```

### Stock rule on escalation resolution

| Escalation reason | Stock action |
|---|---|
| **Out of stock** | **Set `stock_qty = 0`** — the seller has said the item does not exist; restoring re-lists a phantom |
| Any other reason | Restore normally |

Admin is the only role that sees buyer and seller addresses, commission, per-seller delivery fees and
the complete payment picture. **No automatic strikes** — SLA breach feeds the performance record;
admin judges.

---

## 5.6 Cross-Role Lifecycle

**Guest → Buyer → Admin → Seller → Courier → Admin/Return**

The single end-to-end view. Every arrow crossing a lane is a handoff, and handoffs are where this
model's operational risk sits.

```mermaid
sequenceDiagram
    autonumber
    actor G as Guest/Buyer
    participant S as Seller
    participant A as Admin
    participant C as Courier

    G->>G: browse, add fixed-price items to cart
    opt custom item
        G->>S: request price
        S-->>G: quote (price..2x, 24h, prep time)
        G->>G: accept -> cart line, flagged custom
    end

    G->>G: checkout — master + N seller orders created
    Note over G: STOCK DECREMENTS · payment window starts

    alt no proof before window closes
        G-->>G: auto-cancel · stock restored · cart restored
    else proof uploaded
        G->>A: one InstaPay transfer + one proof
        A->>A: verify against BETK's handle
        alt rejected
            A-->>G: cancel · restore stock · refund · notify
        else confirmed
            A->>S: ALL seller orders released (confirmed)
            Note over S: no acceptance step — already committed
        end
    end

    S->>S: preparing -> ready (within prep deadline)
    opt cannot fulfil OR deadline breached
        S->>A: escalation (reported or automatic)
        A-->>G: cancel that seller order · refund · apology
        Note over A: performance record affected
    end

    S->>A: marked ready
    A->>C: courier handoff (API or manual)
    C->>S: collect from pickup address
    C->>G: deliver + collect COD balance
    C->>A: remit COD to BETK
    A->>A: confirm balance row -> seller order closes

    opt return
        G->>S: return request + evidence
        alt seller rejects
            S->>A: dispute
            A-->>G: final decision
        else seller accepts
            S-->>G: return accepted
        end
        A->>G: refund issued
        Note over A: stock NOT auto-restored on return
    end

    A->>S: payout of derived balance after return-hold window
```

### The five handoffs that carry the risk

| # | Handoff | Failure mode | Mitigation in this model |
|---|---|---|---|
| 1 | Buyer → Admin (proof) | Buyer never pays; stock sits held | Payment window + auto-cancel + stock restore |
| 2 | Admin → Seller (release) | Seller ignores a committed order | Prep SLA ladder + auto-escalation |
| 3 | Seller → Courier (ready) | Marked ready, never collected | Admin ready-for-pickup queue |
| 4 | Courier → Buyer (COD) | Collected but not remitted | Admin confirms the balance row before closure |
| 5 | Any → Cancellation | Money held against no order | Refund path is launch-blocking, not fast-follow |

Handoff **2** is the one the v2 model created by removing seller acceptance, and the SLA ladder exists
specifically to close it.
