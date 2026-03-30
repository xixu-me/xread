import { Also, Prop } from "civkit";
import { FirestoreRecord } from "../lib/firestore";

export enum API_CALL_STATUS {
  SUCCESS = "SUCCESS",
  RATE_LIMITED = "RATE_LIMITED",
  FAILED = "FAILED",
}

@Also({
  dictOf: Object,
})
export class ApiRollRecord extends FirestoreRecord {
  static override collectionName = "api-rolls";

  override _id!: string;

  @Prop()
  uid?: string;

  @Prop()
  ip?: string;

  @Prop({ arrayOf: String })
  tags?: string[];

  @Prop()
  status?: API_CALL_STATUS;

  @Prop()
  chargeAmount?: number;

  @Prop()
  createdAt!: Date;
}
