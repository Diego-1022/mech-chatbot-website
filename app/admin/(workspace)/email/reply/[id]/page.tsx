import {AdminScreen} from "@/app/admin/workspace";

export default async function Page({params}: {params:Promise<{id:string}>}) {
  const {id} = await params;
  return <AdminScreen area="email" composeId={id}/>;
}
