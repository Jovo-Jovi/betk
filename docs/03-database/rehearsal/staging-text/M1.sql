-- >>> STAGING-BOUND LITERALS (rehearsal substitutes this block only)
-- <<< STAGING-BOUND LITERALS

-- M1 v2_08_enum_labels. Plan §6 M1, §1.3, ERD §5.
-- ready is placed after preparing so the label order matches ERD §5.
-- New labels are not used in this migration (Postgres 17).

ALTER TYPE betk.order_status ADD VALUE 'ready' AFTER 'preparing';

ALTER TYPE betk.doc_type ADD VALUE 'food_packaging';
ALTER TYPE betk.doc_type ADD VALUE 'food_label';
ALTER TYPE betk.doc_type ADD VALUE 'food_expiry';
ALTER TYPE betk.doc_type ADD VALUE 'food_social_url';

CREATE TYPE betk.escalation_reason AS ENUM (
  'out_of_stock',
  'damaged',
  'cannot_fulfil',
  'sla_breach'
);

CREATE TYPE betk.return_status AS ENUM (
  'requested',
  'accepted',
  'rejected',
  'refunded'
);

CREATE TYPE betk.agreement_document AS ENUM (
  'buyer_terms',
  'seller_agreement',
  'return_policy',
  'privacy'
);
