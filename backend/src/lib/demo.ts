// ═══════════════════════════════════════════════════════════
// lib/demo.ts — Deterministic fallback suggestions
// Used when Gemini is unavailable, rate-limited, or unconfigured.
// All ideas are deterministic for a given (eventType, city, guestCount).
// ═══════════════════════════════════════════════════════════

import { nanoid } from 'nanoid'
import type { IdeaRequest, IdeaItem } from './validate'

type GuestBucket = 'small' | 'medium' | 'large'

function guestBucket(count?: number): GuestBucket {
  if (!count || count <= 50)  return 'small'
  if (count <= 200) return 'medium'
  return 'large'
}

function weddingIdeas(city: string, bucket: GuestBucket, budget: number): IdeaItem[] {
  const costBase = budget < 5_00_000 ? 1 : budget < 15_00_000 ? 2 : 3
  return [
    {
      title: `Traditional ${city} Wedding with Floral Mandap`,
      category: 'theme',
      rationale: 'A traditional ceremony grounds the wedding in local culture while creating stunning visual moments for photography.',
      steps: [
        'Research local florists specialising in marigold and jasmine arrangements',
        'Book a mandap decorator 3–4 months in advance',
        'Coordinate colour palette with bridal attire',
      ],
      estimatedCostMin: 80_000 * costBase,
      estimatedCostMax: 1_50_000 * costBase,
      fitReason: `Suits a ${bucket} wedding in ${city} and stays culturally resonant.`,
    },
    {
      title: 'Live Sarangi + Tabla Ensemble for Ceremony',
      category: 'entertainment',
      rationale: 'Live classical music elevates the ceremony without requiring DJ infrastructure or loud sound systems.',
      steps: [
        'Shortlist ensembles through local music academies',
        'Arrange a short audition performance',
        'Confirm repertoire and ceremony timing',
      ],
      estimatedCostMin: 25_000,
      estimatedCostMax: 70_000,
      fitReason: `Appropriate for a ${bucket} gathering; intimate and memorable.`,
    },
    {
      title: 'Thali-Style Seated Dinner',
      category: 'menu',
      rationale: 'A curated thali controls per-head costs while offering variety; reduces food waste compared to buffets.',
      steps: [
        'Agree on region-specific dishes with caterer',
        'Include at least one Jain option per course',
        'Plan separate dessert station to reduce wastage',
      ],
      estimatedCostMin: 800,
      estimatedCostMax: 1_500,
      fitReason: `Per-head cost suits a ${bucket} guest list within budget.`,
    },
    {
      title: 'Potted Succulents as Centrepieces (Doubles as Guest Favour)',
      category: 'budget-saving',
      rationale: 'Succulents cost less than cut flowers, last the entire event, and guests can take them home — eliminating separate favour costs.',
      steps: [
        'Source from local nurseries; order 8–10 weeks ahead',
        'Add a branded tag with the couple\'s name and date',
        'Ensure they match the table colour palette',
      ],
      estimatedCostMin: 150,
      estimatedCostMax: 350,
      fitReason: 'Saves 20–30% vs traditional floral centrepieces; sustainable choice.',
    },
    {
      title: 'Outdoor Night-Time Photo Zone with String Lights',
      category: 'decor',
      rationale: 'A dedicated photo zone encourages guests to share images online, extending the event\'s reach without a professional social media cost.',
      steps: [
        'Identify a naturally attractive outdoor spot at the venue',
        'Hang warm-white string lights in a canopy configuration',
        'Place a framed hashtag sign for social sharing',
      ],
      estimatedCostMin: 8_000,
      estimatedCostMax: 20_000,
      fitReason: 'Low cost, high visual impact; creates shareable moments.',
    },
    {
      title: 'Pre-Packed Return Gift Hampers with Local Products',
      category: 'logistics',
      rationale: `Sourcing return gifts from local ${city} producers supports small businesses and gives guests something authentically regional.`,
      steps: [
        `Research artisan food producers in ${city}`,
        'Order samples 6 weeks before event',
        'Pack hampers 3 days before with personalised notes',
      ],
      estimatedCostMin: 250,
      estimatedCostMax: 600,
      fitReason: 'Per-guest cost is manageable; memorable and locally meaningful.',
    },
  ]
}

function birthdayIdeas(city: string, bucket: GuestBucket, budget: number): IdeaItem[] {
  const costBase = budget < 50_000 ? 1 : budget < 2_00_000 ? 2 : 3
  return [
    {
      title: 'Tropical Jungle Theme with Leaf and Rattan Decor',
      category: 'theme',
      rationale: 'Tropical themes work well across all ages, photograph beautifully, and can be achieved with affordable plants and rattan accents.',
      steps: [
        'Rent large monstera and palm plants from a plant nursery',
        'Use rattan lanterns and woven placemats as table decor',
        'Choose a colour palette of green, terracotta, and cream',
      ],
      estimatedCostMin: 15_000 * costBase,
      estimatedCostMax: 40_000 * costBase,
      fitReason: `Works well for a ${bucket} birthday in ${city}; visually dramatic on a reasonable budget.`,
    },
    {
      title: 'DIY Dessert Bar Instead of Plated Desserts',
      category: 'menu',
      rationale: 'A self-serve dessert bar reduces staffing costs, creates a focal point, and lets guests choose their own portions.',
      steps: [
        'Order 5–6 different dessert items from a local bakery',
        'Arrange on tiered stands with labels indicating ingredients',
        'Include sugar-free or diabetic-friendly option',
      ],
      estimatedCostMin: 5_000,
      estimatedCostMax: 20_000,
      fitReason: 'Saves 30–40% vs a formal dessert course with plating and service.',
    },
    {
      title: 'Photo Booth with Instant Prints',
      category: 'entertainment',
      rationale: 'A photo booth provides entertainment across age groups and gives guests a tangible keepsake.',
      steps: [
        'Rent a photo booth kit with props and backdrop',
        'Ensure printer supplies are stocked for expected attendance',
        'Create a custom frame design with the birthday person\'s name',
      ],
      estimatedCostMin: 10_000,
      estimatedCostMax: 30_000,
      fitReason: `Suitable for all ${bucket} guest counts; doubles as entertainment and favour.`,
    },
    {
      title: 'Potluck-Style Starter Spread with Personalised Stations',
      category: 'budget-saving',
      rationale: 'Asking close friends or family to each bring a signature dish for starters reduces catering costs significantly.',
      steps: [
        'Coordinate with 8–10 willing participants 2 weeks ahead',
        'Provide nice serving dishes and labels',
        'Have a caterer handle only mains and desserts',
      ],
      estimatedCostMin: 0,
      estimatedCostMax: 5_000,
      fitReason: 'Community-building; saves ₹10,000–₹25,000 on starter catering.',
    },
    {
      title: 'Customised Neon Sign as Décor + Keepsake',
      category: 'decor',
      rationale: 'A neon sign with the birthday person\'s name or a fun phrase becomes the centrepiece and can be kept as a keepsake.',
      steps: [
        'Order from a local sign maker 3–4 weeks in advance',
        'Choose a design that complements the colour palette',
        'Hang against a solid dark backdrop for best photographs',
      ],
      estimatedCostMin: 4_000,
      estimatedCostMax: 12_000,
      fitReason: 'One-time cost; high visual impact and a lasting memory.',
    },
    {
      title: 'Pre-Event Guest Communication Package',
      category: 'logistics',
      rationale: 'A well-designed digital invite and a brief event guide reduces confusion, confirms dietary requirements, and boosts RSVP rates.',
      steps: [
        'Create a digital invite using a free design tool',
        'Include parking, dress code, and RSVP link',
        'Send a reminder 48 hours before the event',
      ],
      estimatedCostMin: 500,
      estimatedCostMax: 2_000,
      fitReason: 'Minimal cost; dramatically improves guest experience and headcount accuracy.',
    },
  ]
}

function communityIdeas(city: string, bucket: GuestBucket, budget: number): IdeaItem[] {
  const _costBase = budget < 1_00_000 ? 1 : budget < 5_00_000 ? 2 : 3
  void _costBase
  return [
    {
      title: 'Open-Stage Talent Showcase',
      category: 'entertainment',
      rationale: 'Community members performing creates investment in the event\'s success and dramatically reduces entertainment costs.',
      steps: [
        'Open registrations 6 weeks before; cap at 15 acts',
        'Set a 5-minute time limit per act',
        'Arrange emcee and a simple judging panel for friendly competition',
      ],
      estimatedCostMin: 5_000,
      estimatedCostMax: 20_000,
      fitReason: `Ideal for a ${bucket} community event; inclusive and cost-effective.`,
    },
    {
      title: 'Regional Food Stalls from Local Vendors',
      category: 'menu',
      rationale: 'Partnering with local food vendors distributes catering responsibility, reduces cost, and showcases regional cuisine.',
      steps: [
        `Identify 6–10 popular food vendors in ${city}`,
        'Agree on a token-based payment system to track sales',
        'Ensure at least two vegetarian and one vegan stall',
      ],
      estimatedCostMin: 0,
      estimatedCostMax: 10_000,
      fitReason: 'Revenue-sharing model means minimal upfront catering cost.',
    },
    {
      title: 'Sponsor-Funded Stage Branding',
      category: 'budget-saving',
      rationale: 'Offering branding space on stage, banners, and programmes to local businesses offsets event costs substantially.',
      steps: [
        'Prepare a sponsorship deck with tier options (Bronze/Silver/Gold)',
        'Approach businesses 2–3 months before the event',
        'Deliver on all promised branding commitments',
      ],
      estimatedCostMin: 0,
      estimatedCostMax: 5_000,
      fitReason: 'Can offset 20–50% of total event cost; win-win for businesses and organizers.',
    },
    {
      title: 'Community Mural or Collaborative Art Installation',
      category: 'decor',
      rationale: 'A large mural created by community members before and during the event becomes both décor and activity.',
      steps: [
        'Source large canvas or wall space from the venue',
        'Set up paint stations with guided prompts',
        'Photograph the completed mural for community archives',
      ],
      estimatedCostMin: 3_000,
      estimatedCostMax: 12_000,
      fitReason: 'Participatory; creates a lasting visual legacy of the event.',
    },
    {
      title: 'Volunteer-Run Registration Desk with Digital Check-In',
      category: 'logistics',
      rationale: 'Digital check-in reduces queue times, eliminates printing costs, and provides accurate attendance data.',
      steps: [
        'Use a free event registration tool (e.g., Google Forms)',
        'Train 3–4 volunteers on the check-in process',
        'Have a manual backup list in case of connectivity issues',
      ],
      estimatedCostMin: 0,
      estimatedCostMax: 2_000,
      fitReason: 'Zero or near-zero cost; significantly improves event flow.',
    },
    {
      title: `Cultural Heritage Corner Showcasing ${city} Traditions`,
      category: 'theme',
      rationale: 'A dedicated corner with artefacts, photographs, and stories about local history anchors the event in community identity.',
      steps: [
        'Reach out to local historians or community elders for contributions',
        'Create simple display boards with captions',
        'Include an interactive quiz or activity for visitors',
      ],
      estimatedCostMin: 2_000,
      estimatedCostMax: 8_000,
      fitReason: 'Low cost; high community value and conversation starter.',
    },
  ]
}

export function getDemoIdeas(request: IdeaRequest): IdeaItem[] {
  const bucket = guestBucket(request.guestCount)
  const city = request.city || 'your city'
  const budget = request.budgetTotal ?? (
    request.budgetBand?.includes('Luxury') || request.budgetBand?.includes('50')
      ? 5_000_000
      : request.budgetBand?.includes('Modest') || request.budgetBand?.includes('Under')
      ? 100_000
      : 1_000_000
  )

  let ideas: IdeaItem[]

  switch (request.eventType) {
    case 'wedding':
      ideas = weddingIdeas(city, bucket, budget)
      break
    case 'birthday':
      ideas = birthdayIdeas(city, bucket, budget)
      break
    case 'community':
      ideas = communityIdeas(city, bucket, budget)
      break
    default:
      ideas = weddingIdeas(city, bucket, budget)
      break
  }

  // Attach stable IDs and normalize practicalSteps
  return ideas.map((idea) => ({
    ...idea,
    id: idea.id || nanoid(10),
    practicalSteps: idea.steps,
  }))
}
