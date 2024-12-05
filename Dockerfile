FROM node:18

WORKDIR /app
COPY . .
RUN yarn

EXPOSE 3111
CMD ["yarn", "start"]
