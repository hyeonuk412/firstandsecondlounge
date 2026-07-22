import { getLoungeContent, adminNicknameStrings } from "../api/lounge-content/store";
import BoardClient from "./BoardClient";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const content = await getLoungeContent();
  const adminNicknames = adminNicknameStrings(content.settings);
  return <BoardClient adminNicknames={adminNicknames} />;
}
