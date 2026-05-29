import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /* =========================
     STATIC FILES
  ========================= */
  app.useStaticAssets(join(__dirname, '..', 'public'));

  /* =========================
     VIEWS (EJS)
  ========================= */
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');

  /* =========================
     PORT
  ========================= */
  const preferredPort = Number(process.env.PORT) || 3000;
  let finalPort = preferredPort;

  try {
    await app.listen(preferredPort);
  } catch (error) {
    console.log(`Port ${preferredPort} occupé → switch 3001`);
    finalPort = 3001;
    await app.listen(finalPort);
  }

  console.log(`Server running on http://localhost:${finalPort}`);
  console.log('Cron system active');
}

bootstrap();