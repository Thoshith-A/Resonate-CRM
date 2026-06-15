// Curated library of win-back campaign objectives the marketer can pick from.
// Each objective is a ready-to-use brief that feeds the AI message drafter
// (POST /api/ai/draft-messages). Grouped by strategic lever; the array is kept
// in category order so the picker renders groups in this sequence.

export type ObjectiveTemplate = {
  id: string;
  /** Short tactic name shown as the row title. */
  label: string;
  /** The objective text inserted into the field and sent to the AI drafter. */
  objective: string;
  /** Strategic lever, used as a group header and for search. */
  category: string;
};

export const OBJECTIVE_TEMPLATES: ObjectiveTemplate[] = [
  // ── Incentive & Pricing ──────────────────────────────────────────────────
  { id: "tiered-winback", label: "Tiered win-back offer", objective: "Win back lapsed customers with a tiered comeback discount that grows with their past spend.", category: "Incentive & Pricing" },
  { id: "miss-you-15", label: "“We miss you” 15% off", objective: "Re-engage quiet customers with a warm 15% “we miss you” comeback discount.", category: "Incentive & Pricing" },
  { id: "free-ship-return", label: "Free shipping to return", objective: "Encourage a return purchase by offering free shipping on their next order.", category: "Incentive & Pricing" },
  { id: "favorite-bundle-deal", label: "Favorite + new bundle", objective: "Bring customers back with a bundle pairing their favorite product and a new release at a special price.", category: "Incentive & Pricing" },
  { id: "spend-threshold-reward", label: "Spend-threshold reward", objective: "Drive a reorder with a spend-threshold reward, e.g. ₹500 off when they restock their usuals.", category: "Incentive & Pricing" },
  { id: "welcome-back-credit", label: "Auto welcome-back credit", objective: "Win them back with an automatic “welcome back” store credit applied at checkout.", category: "Incentive & Pricing" },
  { id: "buy-again-discount", label: "Buy-again discount", objective: "Prompt a repeat purchase with a discount on items they've bought before.", category: "Incentive & Pricing" },
  { id: "gift-with-purchase", label: "Gift with returning order", objective: "Reward returning customers with a free gift on their comeback order.", category: "Incentive & Pricing" },
  { id: "price-lock-sub", label: "Subscriber price lock", objective: "Win back lapsed subscribers with a price-lock guarantee if they restart.", category: "Incentive & Pricing" },
  { id: "loyalty-cashback", label: "Loyalty wallet cashback", objective: "Incentivize the next purchase with cashback credited to their loyalty wallet.", category: "Incentive & Pricing" },

  // ── Exclusivity & VIP ────────────────────────────────────────────────────
  { id: "vip-early-access", label: "VIP early access", objective: "Re-engage lapsed VIPs with early access to a new limited-batch release.", category: "Exclusivity & VIP" },
  { id: "members-tasting-invite", label: "Members-only tasting", objective: "Invite quiet high-value customers to a members-only tasting or launch event.", category: "Exclusivity & VIP" },
  { id: "reinstate-vip", label: "Reinstate VIP perks", objective: "Win back VIPs by reinstating the status and perks they lost while inactive.", category: "Exclusivity & VIP" },
  { id: "insiders-exclusive", label: "Insiders-only product", objective: "Tempt lapsed customers with an exclusive product not available to the public.", category: "Exclusivity & VIP" },
  { id: "concierge-reonboard", label: "Concierge re-onboarding", objective: "Re-engage top lapsed customers with a personal concierge re-onboarding.", category: "Exclusivity & VIP" },
  { id: "first-dibs-drop", label: "First dibs on a drop", objective: "Give lapsed customers first dibs on a seasonal drop before general release.", category: "Exclusivity & VIP" },
  { id: "private-restock", label: "Private restock alert", objective: "Win them back with a private restock alert for a sold-out favorite.", category: "Exclusivity & VIP" },
  { id: "vip-curated-bundle", label: "VIP curated bundle", objective: "Offer a VIP-only bundle curated from their past purchases.", category: "Exclusivity & VIP" },
  { id: "founder-note-vip", label: "Founder's note to VIPs", objective: "Reconnect with top lapsed customers through a personal note from the founder.", category: "Exclusivity & VIP" },
  { id: "ambassador-invite", label: "Ambassador circle invite", objective: "Re-engage loyal-but-quiet customers with an invite to the referral / ambassador circle.", category: "Exclusivity & VIP" },

  // ── Personalization & Relevance ──────────────────────────────────────────
  { id: "next-order-rec", label: "Next-order recommendation", objective: "Win them back by recommending their ideal next order based on past purchases.", category: "Personalization & Relevance" },
  { id: "usual-back-in-stock", label: "“Your usual is back”", objective: "Nudge a reorder by telling customers their usual product is back in stock.", category: "Personalization & Relevance" },
  { id: "replenishment-reminder", label: "Replenishment reminder", objective: "Drive reorders with a reminder timed to each customer's typical replenishment cycle.", category: "Personalization & Relevance" },
  { id: "rebuilt-favorites", label: "Rebuilt favorites bundle", objective: "Re-engage customers with a personalized bundle rebuilt from their favorite items.", category: "Personalization & Relevance" },
  { id: "city-specific-offer", label: "City-specific offer", objective: "Win them back with a localized offer tied to the customer's city.", category: "Personalization & Relevance" },
  { id: "flavor-match", label: "Flavor-profile match", objective: "Recommend a new product that matches a profile the customer already loves.", category: "Personalization & Relevance" },
  { id: "anniversary-message", label: "First-order anniversary", objective: "Reconnect on the anniversary of a customer's first order with a thank-you and offer.", category: "Personalization & Relevance" },
  { id: "birthday-treat", label: "Birthday treat", objective: "Win back customers with a birthday gift or treat to spark a return.", category: "Personalization & Relevance" },
  { id: "resume-subscription", label: "Resume where left off", objective: "Encourage customers to resume a paused or abandoned subscription.", category: "Personalization & Relevance" },
  { id: "behavior-curated-set", label: "Behavior-curated set", objective: "Offer a curated set based on the customer's browsing and buying behavior.", category: "Personalization & Relevance" },

  // ── Urgency & Scarcity ───────────────────────────────────────────────────
  { id: "72h-comeback", label: "72-hour comeback offer", objective: "Drive fast action with a comeback offer that expires in 72 hours.", category: "Urgency & Scarcity" },
  { id: "low-stock-favorite", label: "Low-stock on a favorite", objective: "Prompt a quick reorder with a low-stock alert on the customer's favorite.", category: "Urgency & Scarcity" },
  { id: "points-expiring", label: "Points expiring soon", objective: "Win them back before their loyalty points expire.", category: "Urgency & Scarcity" },
  { id: "24h-flash-sale", label: "24-hour flash sale", objective: "Re-engage with a 24-hour returning-customer flash sale.", category: "Urgency & Scarcity" },
  { id: "seasonal-blend-ending", label: "Seasonal blend ending", objective: "Create urgency around a seasonal product before it's gone for the year.", category: "Urgency & Scarcity" },
  { id: "early-bird-prices", label: "Lock price before rise", objective: "Invite customers back to lock in current prices before they rise.", category: "Urgency & Scarcity" },
  { id: "first-100-deal", label: "First-100 exclusive deal", objective: "Drive urgency with an exclusive deal for the first 100 returning customers.", category: "Urgency & Scarcity" },
  { id: "expiring-credit", label: "Expiring store credit", objective: "Remind customers of expiring store credit to prompt a return.", category: "Urgency & Scarcity" },
  { id: "final-perks-reminder", label: "Final perks reminder", objective: "Send a final reminder before the customer's account perks lapse.", category: "Urgency & Scarcity" },
  { id: "seasonal-scarcity", label: "Limited-season product", objective: "Win them back with a product available only for a limited season.", category: "Urgency & Scarcity" },

  // ── Emotional & Brand Storytelling ───────────────────────────────────────
  { id: "heartfelt-origin", label: "Heartfelt origin story", objective: "Reconnect emotionally with a heartfelt “we miss you” rooted in the brand's origin story.", category: "Emotional & Brand" },
  { id: "how-weve-improved", label: "How we've improved", objective: "Win them back by showing how the product has improved since they left.", category: "Emotional & Brand" },
  { id: "community-impact", label: "Community impact", objective: "Re-engage customers by sharing the brand's community impact and milestones.", category: "Emotional & Brand" },
  { id: "sustainability-story", label: "Sustainability story", objective: "Reconnect through a sustainability story about how their purchase supports farmers.", category: "Emotional & Brand" },
  { id: "behind-the-scenes", label: "Sourcing & roasting story", objective: "Win them back with a behind-the-scenes look at how the coffee is sourced and roasted.", category: "Emotional & Brand" },
  { id: "founder-apology", label: "Founder's apology", objective: "Rebuild the relationship with a sincere founder apology if service fell short.", category: "Emotional & Brand" },
  { id: "shared-values", label: "Shared values", objective: "Reconnect around a shared value like craftsmanship, ethics, or quality.", category: "Emotional & Brand" },
  { id: "nostalgia-first-order", label: "Nostalgia of first order", objective: "Win them back by recalling their first order and what they loved about it.", category: "Emotional & Brand" },
  { id: "whats-new-update", label: "“What's new” update", objective: "Re-engage customers with a warm update on what's new since they last ordered.", category: "Emotional & Brand" },
  { id: "story-not-discount", label: "Story over discount", objective: "Reconnect through brand storytelling rather than a discount.", category: "Emotional & Brand" },

  // ── Loyalty & Retention ──────────────────────────────────────────────────
  { id: "reactivate-subscription", label: "Reactivate subscription", objective: "Win back lapsed subscribers with a flexible plan to restart their subscription.", category: "Loyalty & Retention" },
  { id: "lower-commitment-tier", label: "Lower-commitment tier", objective: "Re-engage churned subscribers with a lower-commitment subscription tier.", category: "Loyalty & Retention" },
  { id: "boost-loyalty-points", label: "Boost loyalty points", objective: "Win them back by restoring and boosting their loyalty points.", category: "Loyalty & Retention" },
  { id: "double-points-event", label: "Double-points event", objective: "Drive returns with a double-points loyalty event for returning customers.", category: "Loyalty & Retention" },
  { id: "onetime-to-subscriber", label: "One-time to subscriber", objective: "Convert lapsed one-time buyers into subscribers with a first-month incentive.", category: "Loyalty & Retention" },
  { id: "refer-a-friend", label: "Refer-a-friend reward", objective: "Re-engage customers with a refer-a-friend reward for coming back.", category: "Loyalty & Retention" },
  { id: "reenroll-headstart", label: "Re-enroll with head-start", objective: "Win them back by re-enrolling them in rewards with a head-start point balance.", category: "Loyalty & Retention" },
  { id: "milestone-reward", label: "Milestone reward", objective: "Offer a milestone reward unlocked on their next purchase.", category: "Loyalty & Retention" },
  { id: "build-your-own-sub", label: "Build-your-own plan", objective: "Re-engage customers with a personalized build-your-own subscription plan.", category: "Loyalty & Retention" },
  { id: "surprise-upgrade", label: "Surprise loyalty upgrade", objective: "Delight returning customers with a surprise loyalty-tier upgrade.", category: "Loyalty & Retention" },

  // ── Social Proof & Trust ─────────────────────────────────────────────────
  { id: "top-reviews", label: "Top product reviews", objective: "Win them back by sharing top reviews of products they used to buy.", category: "Social Proof & Trust" },
  { id: "customers-like-you", label: "“Customers like you”", objective: "Re-engage with social proof: customers like them came back for this.", category: "Social Proof & Trust" },
  { id: "bestseller-untried", label: "Untried best-seller", objective: "Recommend a best-seller the lapsed customer hasn't tried yet.", category: "Social Proof & Trust" },
  { id: "awards-press", label: "Awards & press", objective: "Win them back by highlighting awards and press since they last ordered.", category: "Social Proof & Trust" },
  { id: "ugc-feature", label: "Customer photos & stories", objective: "Reconnect using customer photos and stories featuring the product.", category: "Social Proof & Trust" },
  { id: "results-testimonials", label: "Results testimonials", objective: "Re-engage with testimonials showing real results from the product.", category: "Social Proof & Trust" },
  { id: "community-framing", label: "Returning-community framing", objective: "Win them back by framing the return around a community of returning customers.", category: "Social Proof & Trust" },
  { id: "expert-endorsement", label: "Barista endorsement", objective: "Recommend a product backed by an expert or barista endorsement.", category: "Social Proof & Trust" },
  { id: "ratings-reorder", label: "Ratings-led reorder", objective: "Nudge a reorder on a favorite using its strong ratings.", category: "Social Proof & Trust" },
  { id: "quality-guarantee", label: "Quality guarantee", objective: "Rebuild trust with a quality guarantee and easy returns.", category: "Social Proof & Trust" },

  // ── Re-engagement & Reactivation ─────────────────────────────────────────
  { id: "still-with-us", label: "“Still with us?” check-in", objective: "Send a simple, friendly “are you still with us?” re-engagement check-in.", category: "Re-engagement & Reactivation" },
  { id: "winback-survey", label: "Win-back survey", objective: "Win them back by asking why they left, paired with a thank-you incentive.", category: "Re-engagement & Reactivation" },
  { id: "preference-center", label: "Preference center invite", objective: "Re-engage customers by inviting them to tailor what they receive.", category: "Re-engagement & Reactivation" },
  { id: "re-optin", label: "Re-opt-in invite", objective: "Re-permission lapsed subscribers with a friendly re-opt-in.", category: "Re-engagement & Reactivation" },
  { id: "one-click-reorder", label: "One-click reorder", objective: "Reactivate dormant customers with a frictionless one-click reorder.", category: "Re-engagement & Reactivation" },
  { id: "update-taste-profile", label: "Update taste profile", objective: "Re-engage customers by inviting them to update their taste profile for better picks.", category: "Re-engagement & Reactivation" },
  { id: "channel-switch", label: "Switch to WhatsApp", objective: "Re-engage silent email customers by moving them to WhatsApp.", category: "Re-engagement & Reactivation" },
  { id: "reduce-frequency", label: "Reduce frequency offer", objective: "Win back over-mailed customers by offering a lower email frequency.", category: "Re-engagement & Reactivation" },
  { id: "useful-no-ask", label: "Useful, no-ask content", objective: "Reawaken lapsed customers with genuinely useful content and no hard sell.", category: "Re-engagement & Reactivation" },
  { id: "reset-subscription", label: "Reset subscription", objective: "Re-engage churned subscribers with an easy “reset your subscription” flow.", category: "Re-engagement & Reactivation" },

  // ── Product & Value Education ────────────────────────────────────────────
  { id: "new-products-since", label: "New since you left", objective: "Win them back by introducing products launched since they last ordered.", category: "Product & Value Education" },
  { id: "brew-guide", label: "Brew guide value", objective: "Re-engage customers with a brew guide that deepens the product's value.", category: "Product & Value Education" },
  { id: "problem-solved-better", label: "Problem solved better", objective: "Win them back by showing how the product now solves their problem better.", category: "Product & Value Education" },
  { id: "value-vs-alternatives", label: "Value vs. alternatives", objective: "Re-engage by comparing the product's value against alternatives.", category: "Product & Value Education" },
  { id: "range-expansion", label: "Range expansion", objective: "Win them back by showcasing new ranges like equipment, gifting, and subscriptions.", category: "Product & Value Education" },
  { id: "get-more-tips", label: "Get-more usage tips", objective: "Re-engage with “get more from your coffee” tips and a relevant upsell.", category: "Product & Value Education" },
  { id: "starter-kit", label: "New-category starter kit", objective: "Introduce a starter kit for a category the customer hasn't tried.", category: "Product & Value Education" },
  { id: "recipes-pairings", label: "Recipes & pairings", objective: "Re-engage with seasonal recipes and pairing ideas featuring products.", category: "Product & Value Education" },
  { id: "quality-upgrades", label: "Quality upgrades", objective: "Win them back by demonstrating upgrades in sourcing and roasting quality.", category: "Product & Value Education" },
  { id: "cost-per-cup", label: "Cost-per-cup value", objective: "Reframe value by comparing cost per cup to café prices.", category: "Product & Value Education" },

  // ── Feedback & Service Recovery ──────────────────────────────────────────
  { id: "feedback-act", label: "Ask & act on feedback", objective: "Rebuild the relationship by asking for feedback and showing you've acted on it.", category: "Feedback & Service Recovery" },
  { id: "service-recovery", label: "Service recovery", objective: "Win back customers after a poor experience with an apology and a goodwill offer.", category: "Feedback & Service Recovery" },
  { id: "nps-thankyou", label: "NPS check-in + thanks", objective: "Re-engage with an NPS-style check-in and a thank-you reward.", category: "Feedback & Service Recovery" },
  { id: "stockout-priority", label: "Stockout make-good", objective: "Win them back by apologizing for a stockout and offering priority restock.", category: "Feedback & Service Recovery" },
  { id: "delivery-makegood", label: "Delivery make-good", objective: "Re-engage customers after a delivery issue with a make-good gesture.", category: "Feedback & Service Recovery" },
  { id: "co-creation-vote", label: "Co-creation vote", objective: "Re-engage customers by inviting them to vote on or co-create the next blend.", category: "Feedback & Service Recovery" },
  { id: "what-brings-you-back", label: "“What brings you back?”", objective: "Win them back with an open-ended ask about what would bring them back.", category: "Feedback & Service Recovery" },
  { id: "value-concern", label: "Address price concern", objective: "Re-engage price-sensitive lapsed customers with a value-focused offer.", category: "Feedback & Service Recovery" },
  { id: "satisfaction-guarantee", label: "Satisfaction guarantee", objective: "Rebuild trust with a no-questions satisfaction guarantee.", category: "Feedback & Service Recovery" },
  { id: "support-outreach", label: "Personal support outreach", objective: "Win back high-value lapsed customers with personal outreach from support.", category: "Feedback & Service Recovery" },
];
