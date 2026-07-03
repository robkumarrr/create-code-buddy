FROM node:20-alpine

# Set up the CLI globally in the container
WORKDIR /cli
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Link the package so it's globally available
RUN npm link

# Switch to the workspace directory where the user's code will be mounted
WORKDIR /workspace

# Run the interactive CLI by default
ENTRYPOINT ["create-code-buddy"]
