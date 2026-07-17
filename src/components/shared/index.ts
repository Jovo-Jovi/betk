/**
 * BETK shared design-system components — DS-REGEN barrel.
 * Strict superset of the Phase 03 barrel: every existing export kept verbatim,
 * net-new §7 components appended below. Feature code keeps importing
 * `import { ListingCard, PriceBlock } from "@/components/shared"`.
 * Button/Badge/Card/etc. live in components/ui (the immutable shadcn base) — not re-exported here.
 */

// Trust & status primitives
export { StatusBadge } from "./StatusBadge";
export type { StatusBadgeProps } from "./StatusBadge";
export { StarRating } from "./StarRating";
export type { StarRatingProps } from "./StarRating";
export { LevelBadge } from "./LevelBadge";
export type { LevelBadgeProps } from "./LevelBadge";
export { VerifiedBadge } from "./VerifiedBadge";
export type { VerifiedBadgeProps } from "./VerifiedBadge";
export { StockBadge } from "./StockBadge";
export type { StockBadgeProps } from "./StockBadge";

// Pricing & seller
export { PriceBlock } from "./PriceBlock";
export type { PriceBlockProps } from "./PriceBlock";
export { RatingSummary } from "./RatingSummary";
export type { RatingSummaryProps } from "./RatingSummary";
export { SellerMiniCard } from "./SellerMiniCard";
export type { SellerMiniCardProps } from "./SellerMiniCard";

// Actions
export { WishlistButton } from "./WishlistButton";
export type { WishlistButtonProps } from "./WishlistButton";
export { FollowButton } from "./FollowButton";
export type { FollowButtonProps } from "./FollowButton";

// Catalog cards & discovery
export { ListingCard } from "./ListingCard";
export type { ListingCardProps } from "./ListingCard";
export { StoreCard } from "./StoreCard";
export type { StoreCardProps } from "./StoreCard";
export { CategoryGrid } from "./CategoryGrid";
export type { CategoryGridProps, CategoryItem } from "./CategoryGrid";
export { CollectionStrip } from "./CollectionStrip";
export type { CollectionStripProps } from "./CollectionStrip";
export { ImageGallery } from "./ImageGallery";
export type { ImageGalleryProps } from "./ImageGallery";
export { SearchBar } from "./SearchBar";
export type { SearchBarProps } from "./SearchBar";
export { FilterChips } from "./FilterChips";
export type { FilterChipsProps, FilterChip } from "./FilterChips";
export { FilterSheet } from "./FilterSheet";
export type { FilterSheetProps, FilterValue } from "./FilterSheet";

// Universal state primitives
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";
export { ErrorRetryCard } from "./ErrorRetryCard";
export type { ErrorRetryCardProps } from "./ErrorRetryCard";
export {
  SkeletonGrid,
  SkeletonTable,
  CategoryGridSkeleton,
  ListingCardSkeleton,
  StoreCardSkeleton,
} from "./CatalogSkeletons";

// ── DS-REGEN net-new (brief §5/§7) ──────────────────────────
export { SLABadge } from "./SLABadge";
export type { SLABadgeProps } from "./SLABadge";
export { AppTopbar } from "./AppTopbar";
export type { AppTopbarProps } from "./AppTopbar";
export { MobileBottomNav } from "./MobileBottomNav";
export type { MobileBottomNavProps, BottomNavItem } from "./MobileBottomNav";
export { ConsoleSidebar, SellerSidebar, AdminSidebar } from "./ConsoleSidebar";
export type { ConsoleSidebarProps, SidebarSection, SidebarItem } from "./ConsoleSidebar";
export { ConfirmDialog } from "./ConfirmDialog";
export type { ConfirmDialogProps } from "./ConfirmDialog";
export { Toaster } from "./Toaster";
export { MessageThread } from "./MessageThread";
export type { MessageThreadProps, ThreadMessage } from "./MessageThread";
export { OrderTimeline } from "./OrderTimeline";
export type { OrderTimelineProps, TimelineStep } from "./OrderTimeline";
export { ImageUploader } from "./ImageUploader";
export type { ImageUploaderProps } from "./ImageUploader";
export { AddressForm, AddressSelect } from "./AddressForm";
export type { AddressFormProps, AddressValue, AddressSelectProps, AddressOption } from "./AddressForm";
