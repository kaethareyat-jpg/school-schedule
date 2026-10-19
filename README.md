# ระบบจัดตารางสอนบุคลากร

## นำขึ้นเว็บใช้งานจริง

โปรเจกต์นี้เป็น Node.js จึงไม่สามารถอัปโหลดเฉพาะไฟล์เข้าโฮสต์ PHP ทั่วไปแล้วเปิดใช้ได้โดยตรง ต้องเลือกโฮสติ้งที่รองรับ Node.js เช่น Render, Railway หรือ VPS

### วิธีคลิกครั้งเดียว

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kaethareyat-jpg/school-schedule)

กดปุ่ม **Deploy to Render** ด้านบน แล้วตั้งชื่อเว็บเป็น `school-schedule` จากนั้นกด **Apply** หรือ **Create Web Service** ระบบจะสร้างลิงก์เว็บให้เอง

### วิธีง่ายที่สุด: Render

1. สร้าง GitHub repository ใหม่ แล้วอัปโหลดโฟลเดอร์โปรเจกต์นี้ทั้งหมดขึ้น repository
2. เข้า Render แล้วเลือก **New > Blueprint** และเชื่อม GitHub repository นั้น
3. Render จะอ่าน `render.yaml` ให้อัตโนมัติ กด **Apply** เพื่อสร้างเว็บ
4. เมื่อสร้างเสร็จ Render จะให้ลิงก์ `https://...onrender.com` ซึ่งเปิดได้จากมือถือและเครื่องอื่น

ไฟล์ `render.yaml`, `Dockerfile` และ `.dockerignore` ถูกเตรียมไว้แล้วสำหรับการนำขึ้นระบบ

Node.js / TypeScript backtracking scheduler for school-style timetables.

## What it includes

- A pure scheduler engine with room, teacher, and class-group conflict checks
- Teacher constraints for unavailable slots and max periods per day
- A runnable sample entry point
- A lightweight HTTP API for generating schedules
- Prisma schema scaffolding for future database integration

## Scripts

- `npm start` runs the API server
- `npm run start:sample` runs the sample scheduler output
- `npm test` runs the scheduler rule checks

## API

- `GET /health`
- `GET /sample-data`
- `POST /schedule`

## Notes

- The runtime does not require extra packages.
- Prisma is scaffolded through `prisma/schema.prisma` and can be connected later when you add the database client.
