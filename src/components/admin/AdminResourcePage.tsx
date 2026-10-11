import AdminNav from './AdminNav';
import AdminWorkspace from './AdminWorkspace';
import {requireAdminPage} from '@/lib/auth/admin';

export default async function AdminResourcePage({title,resource,ownerOnly=false}:{title:string;resource:'dashboard'|'bookings'|'products'|'inventory'|'slots'|'zones'|'fitters'|'customers'|'payments'|'settings'|'audit';ownerOnly?:boolean}){
  const actor=await requireAdminPage();
  const isOwner=actor.profile.role==='owner';
  if(ownerOnly&&!isOwner)return <div className="container-g section"><AdminNav/><p role="alert" className="card">Owner access required.</p></div>;
  return <div className="container-g section min-w-0"><AdminNav/><h1 className="display-2 mb-6">{title}</h1><AdminWorkspace resource={resource} canOperate={isOwner||actor.profile.role==='admin'} isOwner={isOwner}/></div>;
}
