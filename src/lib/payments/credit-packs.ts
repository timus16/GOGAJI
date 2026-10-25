export interface CreditPack {
  id: string
  name: string
  credits: number
  price: number // in INR
  description?: string
  popular?: boolean
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 10,
    price: 99,
    description: 'Perfect for trying out the service',
  },
  {
    id: 'popular',
    name: 'Popular Pack',
    credits: 30,
    price: 249,
    description: 'Best value for regular users',
    popular: true,
  },
  {
    id: 'creator',
    name: 'Creator Pack',
    credits: 75,
    price: 499,
    description: 'For power users and creators',
  },
]
