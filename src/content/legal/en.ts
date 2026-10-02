import type { LegalTexts } from "./index";

export const en: LegalTexts = {
  updated: "Version of 2 October 2026",
  draftNote:
    "Draft: this text will be reviewed by a lawyer and completed with company details before launch. The service is currently in test mode.",
  privacy: {
    title: "Privacy policy",
    sections: [
      {
        heading: "1. Who processes your data",
        body: [
          "FoodRescue (the “Service”) is owned by [name of the individual entrepreneur, IIN/BIN, address] (“we”). We are the owner and operator of the database containing your personal data under the Law of the Republic of Kazakhstan “On Personal Data and Their Protection”.",
          "For anything related to your personal data, write to [email].",
        ],
      },
      {
        heading: "2. What we collect",
        body: [
          "When you sign up: your name, email address and password (stored only in encrypted form; we can't read it).",
          "When you order: which bags you ordered, amounts, payment and pickup status, and your pickup code.",
          "For stores: name, address, description, map location, and bag photos and descriptions.",
          "Technical data: cookies that keep you logged in and remember your language, and records of login attempts (to protect against password guessing).",
          "Your location for “Near me” is only used to sort the list and is not stored.",
        ],
      },
      {
        heading: "3. Why we use it",
        body: [
          "To create and run your account, process orders and payments, give the store what it needs for your order (your name and pickup code), refund cancelled orders, protect accounts and the Service from abuse, and answer your questions.",
          "We don't sell your data or use it for third-party advertising.",
        ],
      },
      {
        heading: "4. Legal basis",
        body: [
          "We process personal data with the consent you give when signing up. You can withdraw it by writing to [email]; we will then delete your account, except for data we must keep by law (such as payment records).",
        ],
      },
      {
        heading: "5. Where it's stored",
        body: ["The database containing personal data is stored on servers located in the Republic of Kazakhstan."],
      },
      {
        heading: "6. Who we share it with",
        body: [
          "The store you ordered from: your name, what you ordered and your pickup code.",
          "The payment provider (such as Kaspi or Halyk), as needed for payments and refunds. We never receive or store card details.",
          "Service providers that help run the Service (hosting, sending emails), only for those purposes.",
          "Government authorities, where the law requires it.",
        ],
      },
      {
        heading: "7. How long we keep it",
        body: [
          "Account data is kept while your account exists. Order and payment history is kept for the period the law requires for accounting records. Login-attempt records are deleted within a day.",
        ],
      },
      {
        heading: "8. Your rights",
        body: [
          "You can ask what data we hold about you, have it corrected or deleted, withdraw your consent, and complain to the competent authority. Write to [email].",
        ],
      },
      {
        heading: "9. Security",
        body: [
          "Connections to the Service are encrypted (HTTPS), passwords are stored encrypted, and access to data is restricted. No system is perfectly secure, but we take reasonable measures to protect your data.",
        ],
      },
      {
        heading: "10. Changes",
        body: ["If we change this policy in a meaningful way, we'll ask you to confirm your consent again the next time you log in."],
      },
    ],
  },
  terms: {
    title: "Terms of use",
    sections: [
      {
        heading: "1. About the Service",
        body: [
          "FoodRescue helps stores (cafés, bakeries, shops) sell food left over at the end of the day in discounted “surprise bags”, and helps customers order and collect them. The sale of the food is between the customer and the store; we provide the platform and take the payment.",
        ],
      },
      {
        heading: "2. Accounts",
        body: [
          "Ordering needs a customer account; selling needs a store account. You're responsible for keeping your password safe and for what happens in your account. Use accurate details.",
          "Stores appear in the Service after we check them. We may refuse a listing or block an account that breaks these terms.",
        ],
      },
      {
        heading: "3. Surprise bags",
        body: [
          "The exact contents of a bag aren't known in advance: it contains what's left at the end of the day. The description, category and labels (such as Halal, Vegetarian or possible allergens) are provided by the store.",
          "If you have an allergy or special dietary needs, check the contents with the store before collecting.",
        ],
      },
      {
        heading: "4. Ordering and payment",
        body: [
          "Orders are paid online. When you continue to payment, the bag is held for you for 15 minutes; if payment isn't completed, the bag goes back on sale.",
          "After paying you get a pickup code. Show it at the store during the pickup time in your order.",
        ],
      },
      {
        heading: "5. Cancellations and refunds",
        body: [
          "You can cancel a paid order in “My orders” until the pickup window starts, for a full refund to your payment method. Once pickup has started, orders can't be cancelled.",
          "If you don't collect your order during the pickup window, it isn't refunded.",
          "If the store can't hand over your order, you get a full refund.",
        ],
      },
      {
        heading: "6. Stores' responsibilities",
        body: [
          "Stores are responsible for the quality and safety of their food, following sanitary rules, describing and labelling bags accurately, and handing over orders at the stated time.",
        ],
      },
      {
        heading: "7. Not allowed",
        body: [
          "Using the Service in breach of the law, misleading other users, posting photos you don't have the rights to, trying to access other people's accounts, or disrupting the Service.",
        ],
      },
      {
        heading: "8. Liability",
        body: [
          "We work to keep the Service running smoothly but can't guarantee it. We aren't responsible for the food or the stores' actions, but we help resolve disputes and refund in the cases described above.",
        ],
      },
      {
        heading: "9. Changes and contact",
        body: ["We may update these terms; we'll tell you about meaningful changes and ask you to agree again. Questions and complaints: [email]."],
      },
    ],
  },
};
