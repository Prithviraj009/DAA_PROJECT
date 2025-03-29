"use client";
import React, { useEffect, useState, useCallback } from "react";
import tt from "@tomtom-international/web-sdk-maps";
import "@tomtom-international/web-sdk-maps/dist/maps.css";

const API_KEY = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;

// Button component
function Button({ children, variant = "default", className = "", ...props }) {
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
    const variants = {
        default: "bg-blue-600 hover:bg-blue-700 text-white",
        destructive: "bg-red-600 hover:bg-red-700 text-white",
    };
    return <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>{children}</button>;
}

export default function Home() {
    const [map, setMap] = useState(null);
    const [markers, setMarkers] = useState([]);
    const [routeLayer, setRouteLayer] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [markerCounter, setMarkerCounter] = useState(1);

    useEffect(() => {
        navigator.geolocation.watchPosition(
            ({ coords }) => {
                const location = { lat: coords.latitude, lng: coords.longitude };
                setUserLocation(location);

                const mapInstance = tt.map({
                    key: API_KEY,
                    container: "map",
                    center: location,
                    zoom: 12,
                    showZoom: true,
                    showCompass: true
                });

                new tt.Marker({ color: "blue" })
                    .setLngLat([location.lng, location.lat])
                    .addTo(mapInstance);

                mapInstance.on("click", (event) => handleMapClick(event, mapInstance));
                setMap(mapInstance);
            },
            () => alert("Geolocation permission denied. Using default location."));
    }, []);

    const handleMapClick = useCallback((event, mapInstance) => {
        const { lngLat } = event;
        const newMarker = new tt.Marker({ color: "red" })
            .setLngLat([lngLat.lng, lngLat.lat])
            .addTo(mapInstance);

        setMarkers(prev => [...prev, newMarker]);
        setMarkerCounter(prev => prev + 1);
    }, [markerCounter]);

    const calculateRoute = async () => {
        if (!userLocation || markers.length < 1) {
            alert("Select at least one destination!");
            return;
        }

        const waypoints = [`${userLocation.lat},${userLocation.lng}`,
        ...markers.map(marker => `${marker.getLngLat().lat},${marker.getLngLat().lng}`)].join(":");

        const url = `https://api.tomtom.com/routing/1/calculateRoute/${waypoints}/json?key=${API_KEY}&routeRepresentation=polyline`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!data.routes || data.routes.length === 0) {
                alert("No route found! Try placing markers on roads.");
                return;
            }

            const routeCoordinates = data.routes[0].legs.flatMap(leg =>
                leg.points.map(point => [point.longitude, point.latitude])
            );

            const routeGeoJSON = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    geometry: { type: "LineString", coordinates: routeCoordinates }
                }]
            };

            if (map.getLayer("route")) map.removeLayer("route");
            if (map.getSource("route")) map.removeSource("route");

            map.addSource("route", { type: "geojson", data: routeGeoJSON });
            map.addLayer({
                id: "route",
                type: "line",
                source: "route",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": "#ff0000", "line-width": 5 }
            });

        } catch (error) {
            alert("Failed to fetch route. Check your API key or selected locations.");
        }
    };

    const clearMap = () => {
        markers.forEach(marker => marker.remove());
        setMarkers([]);
        setMarkerCounter(1);

        if (map.getLayer("route")) map.removeLayer("route");
        if (map.getSource("route")) map.removeSource("route");
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        TomTom Route Optimizer
                    </h1>
                    <p className="text-lg text-gray-600">
                        Click on the map to add markers and optimize your route
                    </p>
                </div>
                <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
                    <div id="map" className="w-full h-[600px] border border-gray-200"></div>
                </div>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button onClick={calculateRoute} disabled={!markers.length} className="px-6 py-2">
                        Optimize Route
                    </Button>
                    <Button onClick={clearMap} variant="destructive" className="px-6 py-2">
                        Clear Markers
                    </Button>
                </div>
            </div>
        </div>
    );
}
