FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS restore
WORKDIR /src
COPY backend/Directory.Build.props backend/Household.slnx ./
COPY backend/src/Household.Api/Household.Api.csproj src/Household.Api/
COPY backend/src/Household.Updater/Household.Updater.csproj src/Household.Updater/
COPY backend/tests/Household.Api.Tests/Household.Api.Tests.csproj tests/Household.Api.Tests/
RUN dotnet restore src/Household.Api/Household.Api.csproj

FROM restore AS build
COPY backend/src/Household.Api/ src/Household.Api/
RUN dotnet publish src/Household.Api/Household.Api.csproj --no-restore --configuration Release --output /app

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS dev
WORKDIR /src
COPY backend/ ./
RUN dotnet restore src/Household.Api/Household.Api.csproj
ENV DOTNET_WATCH_RESTART_ON_RUDE_EDIT=true
ENTRYPOINT ["dotnet", "watch", "--non-interactive", "--project", "src/Household.Api/Household.Api.csproj", "run", "--no-launch-profile"]

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS release
WORKDIR /app
RUN apk add --no-cache ca-certificates wget
COPY --from=build /app .
USER $APP_UID
ENTRYPOINT ["dotnet", "Household.Api.dll"]
