export const campaignTemplates = {
  vip: {
    name: "VIP Growth Campaign",
    description: "Exclusive offers and perks for VIP customers",
    template: "Welcome to our VIP club! 🌟 {{customMessage}} Reply {{keyword}} for exclusive offers and updates. {{offerDetails}}",
    fields: [
      {
        id: "customMessage",
        label: "Custom Welcome Message",
        type: "text",
        placeholder: "Enter a personalized welcome message"
      },
      {
        id: "offerDetails",
        label: "Offer Details",
        type: "textarea",
        placeholder: "Enter the VIP offer details"
      }
    ]
  },
  loyalty: {
    name: "Loyalty Rewards Campaign",
    description: "Reward returning customers with points and special offers",
    template: "Thanks for your loyalty! 🎁 {{pointsMessage}} {{rewardDetails}} Text {{keyword}} to check your points balance.",
    fields: [
      {
        id: "pointsMessage",
        label: "Points Message",
        type: "text",
        placeholder: "Enter points earning message"
      },
      {
        id: "rewardDetails",
        label: "Reward Details",
        type: "textarea",
        placeholder: "Enter the reward program details"
      }
    ]
  },
  celebration: {
    name: "Celebration Campaign",
    description: "Special offers for birthdays and anniversaries",
    template: "🎉 {{celebrationType}}! {{celebrationMessage}} Use code {{keyword}} to claim your {{offerType}}.",
    fields: [
      {
        id: "celebrationType",
        label: "Celebration Type",
        type: "select",
        options: ["Happy Birthday", "Happy Anniversary", "Congratulations"]
      },
      {
        id: "celebrationMessage",
        label: "Celebration Message",
        type: "text",
        placeholder: "Enter your celebration message"
      },
      {
        id: "offerType",
        label: "Offer Type",
        type: "text",
        placeholder: "Enter the special offer"
      }
    ]
  },
  coupon: {
    name: "Digital Coupon Campaign",
    description: "Distribute digital coupons via SMS",
    template: "Your exclusive coupon: {{couponCode}} 💰 {{discountDetails}} Text {{keyword}} to redeem. {{terms}}",
    fields: [
      {
        id: "couponCode",
        label: "Coupon Code",
        type: "text",
        placeholder: "Enter coupon code"
      },
      {
        id: "discountDetails",
        label: "Discount Details",
        type: "text",
        placeholder: "Enter discount details"
      },
      {
        id: "terms",
        label: "Terms & Conditions",
        type: "textarea",
        placeholder: "Enter terms and conditions"
      }
    ]
  }
};