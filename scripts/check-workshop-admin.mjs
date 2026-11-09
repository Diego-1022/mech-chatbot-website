import assert from "node:assert/strict";
import {todaySydney, datePlus} from "../lib/catalog.ts";

const origin = "http://127.0.0.1:5187";
assert.ok(process.env.HARBOUR_TEST_ADMIN_PASSWORD, "Provide the isolated local admin fixture password.");

async function post(payload, cookie = "", route = "/api/workshop") {
  return fetch(origin + route, {
    method: "POST",
    headers: {Origin: origin, "Content-Type": "application/json", Cookie: cookie},
    body: JSON.stringify(payload),
  });
}

async function get(action, cookie = "") {
  return fetch(origin + "/api/workshop?action=" + action, {headers: {Cookie: cookie}});
}

const login = await post({password: process.env.HARBOUR_TEST_ADMIN_PASSWORD}, "", "/api/admin-session");
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";")[0];
const date = datePlus(todaySydney(), 7);
const day = new Date(date + "T12:00:00Z").getUTCDay();
const openDate = day === 0 ? datePlus(date, 1) : date;
const time = "10:00";
const requestId = crypto.randomUUID();
const draft = {
  action: "adminRequest", requestId, date: openDate, time, service: "service",
  name: "Test Driver", email: "driver@example.test", phone: "0491570006",
  vehicle: "2020 Toyota Corolla", notes: "测试备注",
};
assert.equal((await get("adminWeek&start=" + openDate)).status, 403);
for (const payload of [draft, {action:"adminConfirmRequest",id:requestId}, {action:"adminNotice",en:"test",zh:""}]) {
  assert.equal((await post(payload)).status, 403);
}
assert.equal((await get("adminWeek&start=2026-02-31", cookie)).status, 400);
assert.equal((await post(draft, cookie)).status, 201);
assert.equal((await post(draft, cookie)).status, 201);
const week = await (await get("adminWeek&start=" + openDate, cookie)).json();
assert.deepEqual(week.bookings, [{id: requestId, date: openDate, time, service: "service", status: "requested"}]);
assert.ok((await (await get("availability&date=" + openDate)).json()).times.includes(time));
assert.equal((await post({action:"block", date:openDate, time}, cookie)).status, 200);
const conflict = await post({action:"adminConfirmRequest",id:requestId}, cookie);
assert.equal(conflict.status, 409);
assert.equal((await conflict.json()).error, "SLOT_TAKEN");
const dayRows = await (await get("admin&date=" + openDate, cookie)).json();
assert.equal(dayRows.bookings.find(row => row.id === requestId).status, "requested");
const closure = dayRows.bookings.find(row => row.status === "blocked");
assert.equal((await post({action:"adminStatus", id:closure.id, status:"cancelled"},cookie)).status,200);
assert.equal((await post({action:"adminConfirmRequest",id:requestId},cookie)).status,200);
assert.ok(!(await (await get("availability&date=" + openDate)).json()).times.includes(time));
assert.equal((await post({action:"adminConfirmRequest",id:requestId},cookie)).status,409);
const notice={en:"Closed for the holiday.",zh:"假期暂停营业。"};
assert.equal((await post({action:"adminNotice",...notice},cookie)).status,200);
assert.deepEqual(await (await get("notice")).json(), {notice});
assert.equal((await post({action:"adminNotice",en:"",zh:""},cookie)).status,200);
assert.deepEqual(await (await get("notice")).json(), {notice:{en:"",zh:""}});
console.log("Workshop admin integration passed: authorization, week bounds, idempotent requests, tentative availability, conflict and confirmation, notice publish and removal.");
