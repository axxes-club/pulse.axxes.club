import { requireContext } from '@/lib/context'
import { getCustomerBrand } from '@/lib/white-label'
import { BrandScope } from '@/components/brand'
export default async function AppLayout({children}:{children:React.ReactNode}){const ctx=await requireContext();const brand=await getCustomerBrand(ctx.tenant.id);return <BrandScope brand={brand}>{children}</BrandScope>}
