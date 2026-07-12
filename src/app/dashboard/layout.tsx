import { DashboardNav } from "@/components/DashboardNav";
import { requireSession } from "@/lib/session";
export default async function DashboardLayout({children}:{children:React.ReactNode}){await requireSession();return <div style={{display:"grid",gridTemplateColumns:"240px minmax(0,1fr)",minHeight:"100vh"}}><DashboardNav/><main style={{padding:"32px",minWidth:0}}>{children}</main></div>}
