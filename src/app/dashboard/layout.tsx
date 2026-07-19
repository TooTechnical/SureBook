import { DashboardNav } from "@/components/DashboardNav";
import { requireSession } from "@/lib/session";
export default async function DashboardLayout({children}:{children:React.ReactNode}){await requireSession();return <div className="dashboard-shell"><DashboardNav/><main className="dashboard-main" id="main-content">{children}</main></div>}
