#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <iomanip>
#include <numeric>
#include <string_view>
#include <type_traits>
#include <vector>

#if defined(_WIN32)
#include <intrin.h>
#endif

#if defined(_MSC_VER)
#define CAMERA_NOINLINE __declspec(noinline)
#else
#define CAMERA_NOINLINE __attribute__((noinline))
#endif
#define CAMERA_STRINGIZE_IMPL(value) #value
#define CAMERA_STRINGIZE(value) CAMERA_STRINGIZE_IMPL(value)

template<typename T, int MaxCapacity>
class MinimalVector
{
private:
    T m_Data[MaxCapacity];
    int m_Size{ 0 };

public:
    void PushBack(const T& element)
    {
        if (m_Size < MaxCapacity)
        {
            m_Data[m_Size++] = element;
        }
    }

    T& operator[](int index) { return m_Data[index]; }
    const T& operator[](int index) const { return m_Data[index]; }
    int Size() const { return m_Size; }
};

class Vector3
{
public:
    double X{ 0.0 }, Y{ 0.0 }, Z{ 0.0 };

    constexpr Vector3() noexcept = default;
    constexpr Vector3(double x, double y, double z) noexcept : X(x), Y(y), Z(z) {}
    explicit constexpr Vector3(double scalar) noexcept : X(scalar), Y(scalar), Z(scalar) {}

    [[nodiscard]] static constexpr Vector3 Zero() noexcept { return { 0.0, 0.0, 0.0 }; }
    [[nodiscard]] static constexpr Vector3 One()  noexcept { return { 1.0, 1.0, 1.0 }; }

    [[nodiscard]] constexpr Vector3 operator+(const Vector3& rhs) const noexcept { return { X + rhs.X, Y + rhs.Y, Z + rhs.Z }; }
    [[nodiscard]] constexpr Vector3 operator-(const Vector3& rhs) const noexcept { return { X - rhs.X, Y - rhs.Y, Z - rhs.Z }; }
    [[nodiscard]] constexpr Vector3 operator*(const Vector3& rhs) const noexcept { return { X * rhs.X, Y * rhs.Y, Z * rhs.Z }; }
    [[nodiscard]] constexpr Vector3 operator/(const Vector3& rhs) const noexcept { return { X / rhs.X, Y / rhs.Y, Z / rhs.Z }; }

    [[nodiscard]] constexpr Vector3 operator*(double scalar) const noexcept { return { X * scalar, Y * scalar, Z * scalar }; }
    [[nodiscard]] constexpr Vector3 operator/(double scalar) const noexcept { return { X / scalar, Y / scalar, Z / scalar }; }

    constexpr Vector3& operator+=(const Vector3& rhs) noexcept { X += rhs.X; Y += rhs.Y; Z += rhs.Z; return *this; }
    constexpr Vector3& operator*=(double scalar)       noexcept { X *= scalar; Y *= scalar; Z *= scalar; return *this; }

    [[nodiscard]] bool Equals(const Vector3& other, double tolerance = 1e-8) const noexcept
    {
        return fabs(X - other.X) <= tolerance &&
            fabs(Y - other.Y) <= tolerance &&
            fabs(Z - other.Z) <= tolerance;
    }

    [[nodiscard]] constexpr double Dot(const Vector3& rhs) const noexcept
    {
        return X * rhs.X + Y * rhs.Y + Z * rhs.Z;
    }

    [[nodiscard]] constexpr Vector3 Cross(const Vector3& rhs) const noexcept
    {
        return { Y * rhs.Z - Z * rhs.Y, Z * rhs.X - X * rhs.Z, X * rhs.Y - Y * rhs.X };
    }

    [[nodiscard]] constexpr double LengthSq() const noexcept { return Dot(*this); }
    [[nodiscard]] double Length() const noexcept { return sqrt(LengthSq()); }

    [[nodiscard]] Vector3 Normalized(double tolerance = 1e-8) const noexcept
    {
        const double lenSq = LengthSq();
        if (lenSq > tolerance)
        {
            return *this * (1.0 / sqrt(lenSq));
        }
        return Zero();
    }

    void Normalize(double tolerance = 1e-8) noexcept { *this = Normalized(tolerance); }

    [[nodiscard]] static constexpr Vector3 Lerp(const Vector3& a, const Vector3& b, double t) noexcept
    {
        return a + (b - a) * t;
    }
};

[[nodiscard]] inline constexpr Vector3 operator*(double scalar, const Vector3& vec) noexcept
{
    return vec * scalar;
}

class Quaternion
{
public:
    double X{ 0.0 }, Y{ 0.0 }, Z{ 0.0 }, W{ 1.0 };

    constexpr Quaternion() noexcept = default;
    constexpr Quaternion(double x, double y, double z, double w) noexcept : X(x), Y(y), Z(z), W(w) {}

    [[nodiscard]] static constexpr Quaternion Identity() noexcept { return { 0.0, 0.0, 0.0, 1.0 }; }

    [[nodiscard]] static Quaternion FromEuler(double pitch, double yaw, double roll) noexcept
    {
        const double hp = pitch * 0.5;
        const double hy = yaw * 0.5;
        const double hr = roll * 0.5;

        const double sp = sin(hp), cp = cos(hp);
        const double sy = sin(hy), cy = cos(hy);
        const double sr = sin(hr), cr = cos(hr);

        return {
            sp * cy * cr - cp * sy * sr,
            cp * sy * cr + sp * cy * sr,
            cp * cy * sr - sp * sy * cr,
            cp * cy * cr + sp * sy * sr
        };
    }

    [[nodiscard]] constexpr Quaternion operator*(const Quaternion& rhs) const noexcept
    {
        return {
            W * rhs.X + X * rhs.W + Y * rhs.Z - Z * rhs.Y,
            W * rhs.Y - X * rhs.Z + Y * rhs.W + Z * rhs.X,
            W * rhs.Z + X * rhs.Y - Y * rhs.X + Z * rhs.W,
            W * rhs.W - X * rhs.X - Y * rhs.Y - Z * rhs.Z
        };
    }

    [[nodiscard]] Vector3 RotateVector(const Vector3& v) const noexcept
    {
        const Vector3 qVec(X, Y, Z);
        const Vector3 t = 2.0 * qVec.Cross(v);
        return v + (W * t) + qVec.Cross(t);
    }

    [[nodiscard]] constexpr Quaternion operator*(double scalar) const noexcept
    {
        return { X * scalar, Y * scalar, Z * scalar, W * scalar };
    }

    [[nodiscard]] constexpr Quaternion operator+(const Quaternion& rhs) const noexcept
    {
        return { X + rhs.X, Y + rhs.Y, Z + rhs.Z, W + rhs.W };
    }

    [[nodiscard]] constexpr double LengthSq() const noexcept { return X * X + Y * Y + Z * Z + W * W; }

    [[nodiscard]] Quaternion Normalized(double tolerance = 1e-8) const noexcept
    {
        const double lenSq = LengthSq();
        if (lenSq > tolerance)
        {
            return *this * (1.0 / sqrt(lenSq));
        }
        return Identity();
    }

    [[nodiscard]] constexpr double Dot(const Quaternion& rhs) const noexcept
    {
        return X * rhs.X + Y * rhs.Y + Z * rhs.Z + W * rhs.W;
    }

    [[nodiscard]] static Quaternion Slerp(Quaternion a, Quaternion b, double t) noexcept
    {
        double dot = a.Dot(b);

        if (dot < 0.0)
        {
            b = b * -1.0;
            dot = -dot;
        }

        const double DOT_THRESHOLD = 0.9995;
        if (dot > DOT_THRESHOLD)
        {
            return (a + (b + (a * -1.0)) * t).Normalized();
        }

        const double theta0 = acos(dot);
        const double theta = theta0 * t;
        const double sinTheta = sin(theta);
        const double sinTheta0 = sin(theta0);

        const double s0 = cos(theta) - dot * sinTheta / sinTheta0;
        const double s1 = sinTheta / sinTheta0;

        return (a * s0) + (b * s1);
    }
};

class Transform
{
public:
    Vector3    Location{ 0.0, 0.0, 0.0 };
    Quaternion Orientation{ 0.0, 0.0, 0.0, 1.0 };
    Vector3    Scale{ 1.0, 1.0, 1.0 };

    constexpr Transform() noexcept = default;
    constexpr Transform(const Vector3& location, const Quaternion& orientation, const Vector3& scale) noexcept
        : Location(location), Orientation(orientation), Scale(scale) {
    }
};

class GameManager;

class Entity
{
public:
    Transform Transform;
    virtual ~Entity() = default;
};

// Extracted to ensure all 3 cameras do the exact same arithmetic workload every frame.
inline void ApplyCameraFollowMath(Transform& camTransform, const Transform& targetTransform, double DeltaTime)
{
    Vector3 offset{ 0.0, 50.0, -100.0 };
    Vector3 desiredPos = targetTransform.Location + offset;

    camTransform.Location = Vector3::Lerp(camTransform.Location, desiredPos, DeltaTime * 5.0);

    Vector3 dir = (targetTransform.Location - camTransform.Location).Normalized();
    Quaternion desiredRot = Quaternion::FromEuler(dir.X, dir.Y, dir.Z);
    camTransform.Orientation = Quaternion::Slerp(camTransform.Orientation, desiredRot, DeltaTime * 5.0);
}

class CameraStateless : public Entity
{
public:
    void Tick(double DeltaTime, const GameManager& GM);
};

class CameraHybrid : public Entity
{
private:
    Entity* CurrentTarget = nullptr;

public:
    void Tick(double DeltaTime, const GameManager& GM);
};

class CameraStateful : public Entity
{
private:
    Entity* CurrentTarget = nullptr;

public:
    void MoveToTarget(Entity* Target)
    {
        CurrentTarget = Target;
    }

    CAMERA_NOINLINE void Tick(double DeltaTime)
    {
        if (CurrentTarget)
        {
            ApplyCameraFollowMath(this->Transform, CurrentTarget->Transform, DeltaTime);
        }
    }
};

class CameraManager
{
public:
    CameraStateless* Stateless = nullptr;
    CameraStateful* Stateful = nullptr;
    CameraHybrid* Hybrid = nullptr;

    void Tick(double DeltaTime, const GameManager& GM)
    {
        if (Stateless) Stateless->Tick(DeltaTime, GM);
        if (Hybrid)    Hybrid->Tick(DeltaTime, GM);
        if (Stateful)  Stateful->Tick(DeltaTime);
    }
};

class GameManager
{
public:
    MinimalVector<Entity*, 16> AllEntities;
    Entity* ActiveEntity = nullptr;
    CameraManager* CamManager = nullptr;

    int CurrentTargetIndex = 0;

    Entity* GetActiveEntity() const
    {
        return ActiveEntity;
    }

    void SetActiveEntity(int Index)
    {
        if (Index >= 0 && Index < AllEntities.Size())
        {
            ActiveEntity = AllEntities[Index];
            CurrentTargetIndex = Index;

            if (CamManager && CamManager->Stateful)
            {
                CamManager->Stateful->MoveToTarget(ActiveEntity);
            }
        }
    }

    void Tick(double DeltaTime)
    {
        if (!ActiveEntity) return;

        ActiveEntity->Transform.Location.Z += 50.0 * DeltaTime;

        if (ActiveEntity->Transform.Location.Z > 200.0)
        {
            ActiveEntity->Transform.Location.Z = 0.0;

            int nextIndex = (CurrentTargetIndex + 1) % AllEntities.Size();
            SetActiveEntity(nextIndex);
        }
    }
};

CAMERA_NOINLINE void CameraStateless::Tick(double DeltaTime, const GameManager& GM)
{
    Entity* FocusTarget = GM.GetActiveEntity();

    if (FocusTarget)
    {
        ApplyCameraFollowMath(this->Transform, FocusTarget->Transform, DeltaTime);
    }
}

CAMERA_NOINLINE void CameraHybrid::Tick(double DeltaTime, const GameManager& GM)
{
    Entity* FocusTarget = GM.GetActiveEntity();

    if (FocusTarget != CurrentTarget)
    {
        CurrentTarget = FocusTarget;
    }

    if (CurrentTarget)
    {
        ApplyCameraFollowMath(this->Transform, CurrentTarget->Transform, DeltaTime);
    }
}


namespace Benchmark
{
    using Clock = std::chrono::steady_clock;

    constexpr double DeltaTime = 0.0166667;
    constexpr std::size_t IterationsPerTrial = 1'000'000;
    constexpr std::size_t WarmupIterations = 100'000;
    constexpr std::size_t TrialCount = 31;
    constexpr std::size_t ManagerCount = 1u << 18;
    constexpr std::size_t ManagerMask = ManagerCount - 1;
    constexpr std::size_t ManagerStride = 16'381;

    static_assert((ManagerCount & ManagerMask) == 0,
        "ManagerCount must be a power of two.");
    static_assert((ManagerStride & 1u) == 1u,
        "An odd stride visits every element of the power-of-two working set.");

    volatile double ResultSink = 0.0;

    struct Summary
    {
        double Minimum = 0.0;
        double Median = 0.0;
        double Mean = 0.0;
        double P95 = 0.0;
        double StandardDeviation = 0.0;
    };

    struct TrialResults
    {
        std::array<std::vector<double>, 3> Samples;
        std::array<Summary, 3> Summaries;
    };

    void Consume(const Transform& value)
    {
        ResultSink = ResultSink + value.Location.X + value.Location.Y +
            value.Location.Z + value.Orientation.W;
    }

    template<typename Camera, typename Tick>
    double MeasureHot(Entity& target, GameManager& manager, std::size_t iterations, Tick tick)
    {
        Camera camera;
        if constexpr (std::is_same_v<Camera, CameraStateful>)
        {
            camera.MoveToTarget(&target);
        }

        const auto start = Clock::now();
        for (std::size_t index = 0; index < iterations; ++index)
        {
            tick(camera, manager);
        }
        const auto stop = Clock::now();
        Consume(camera.Transform);

        return std::chrono::duration<double, std::nano>(stop - start).count() /
            static_cast<double>(iterations);
    }

    template<typename Camera, typename Tick>
    double MeasureCachePressure(Entity& target, std::vector<GameManager>& managers,
        std::size_t iterations, Tick tick)
    {
        Camera camera;
        if constexpr (std::is_same_v<Camera, CameraStateful>)
        {
            camera.MoveToTarget(&target);
        }

        // Volatile preserves identical index-generation work for every approach.
        // Only polling cameras dereference the selected, widely scattered manager.
        volatile std::size_t managerIndex = 0;
        const auto start = Clock::now();
        for (std::size_t index = 0; index < iterations; ++index)
        {
            managerIndex = (managerIndex + ManagerStride) & ManagerMask;
            tick(camera, managers[managerIndex]);
        }
        const auto stop = Clock::now();
        ResultSink = ResultSink + static_cast<double>(managerIndex);
        Consume(camera.Transform);

        return std::chrono::duration<double, std::nano>(stop - start).count() /
            static_cast<double>(iterations);
    }

    Summary Summarize(std::vector<double> samples)
    {
        std::sort(samples.begin(), samples.end());

        Summary summary;
        summary.Minimum = samples.front();
        summary.Median = samples[samples.size() / 2];
        summary.Mean = std::accumulate(samples.begin(), samples.end(), 0.0) /
            static_cast<double>(samples.size());
        const std::size_t p95Index = static_cast<std::size_t>(
            std::ceil(0.95 * static_cast<double>(samples.size()))) - 1;
        summary.P95 = samples[std::min(p95Index, samples.size() - 1)];

        double squaredDifferenceSum = 0.0;
        for (const double sample : samples)
        {
            const double difference = sample - summary.Mean;
            squaredDifferenceSum += difference * difference;
        }
        summary.StandardDeviation = std::sqrt(
            squaredDifferenceSum / static_cast<double>(samples.size() - 1));
        return summary;
    }

    bool VerifyEquivalentResults()
    {
        GameManager manager;
        CameraManager cameraManager;
        manager.CamManager = &cameraManager;

        CameraStateless stateless;
        CameraHybrid hybrid;
        CameraStateful stateful;
        cameraManager.Stateless = &stateless;
        cameraManager.Hybrid = &hybrid;
        cameraManager.Stateful = &stateful;

        Entity firstPlayer;
        Entity secondPlayer;
        firstPlayer.Transform.Location = Vector3(0.0, 0.0, 0.0);
        secondPlayer.Transform.Location = Vector3(100.0, 0.0, 50.0);
        manager.AllEntities.PushBack(&firstPlayer);
        manager.AllEntities.PushBack(&secondPlayer);
        manager.SetActiveEntity(0);

        for (int frame = 0; frame < 600; ++frame)
        {
            manager.Tick(DeltaTime);
            cameraManager.Tick(DeltaTime, manager);
        }

        const auto equivalent = [](const Transform& left, const Transform& right)
        {
            return left.Location.Equals(right.Location) &&
                std::fabs(left.Orientation.X - right.Orientation.X) <= 1e-8 &&
                std::fabs(left.Orientation.Y - right.Orientation.Y) <= 1e-8 &&
                std::fabs(left.Orientation.Z - right.Orientation.Z) <= 1e-8 &&
                std::fabs(left.Orientation.W - right.Orientation.W) <= 1e-8;
        };

        return equivalent(stateless.Transform, hybrid.Transform) &&
            equivalent(stateless.Transform, stateful.Transform);
    }

    std::array<TrialResults, 2> CollectTrials(
        const std::array<std::function<double()>, 6>& runners)
    {
        std::array<TrialResults, 2> results;
        for (TrialResults& scenario : results)
        {
            for (auto& values : scenario.Samples)
            {
                values.reserve(TrialCount);
            }
        }

        // Interleave both scenarios and rotate all six execution positions to
        // distribute thermal, frequency, and scheduler effects across variants.
        for (std::size_t trial = 0; trial < TrialCount; ++trial)
        {
            for (std::size_t order = 0; order < runners.size(); ++order)
            {
                const std::size_t variant = (trial + order) % runners.size();
                const std::size_t scenario = variant / 3;
                const std::size_t approach = variant % 3;
                results[scenario].Samples[approach].push_back(runners[variant]());
            }
        }

        for (TrialResults& scenario : results)
        {
            for (std::size_t approach = 0; approach < scenario.Samples.size(); ++approach)
            {
                scenario.Summaries[approach] = Summarize(scenario.Samples[approach]);
            }
        }
        return results;
    }

    void PrintRow(std::string_view scenario, std::string_view approach,
        const Summary& summary)
    {
        std::printf("summary,%.*s,%.*s,,%zu,%zu,%.3f,%.3f,%.3f,%.3f,%.3f,,\n",
            static_cast<int>(scenario.size()), scenario.data(),
            static_cast<int>(approach.size()), approach.data(),
            IterationsPerTrial, TrialCount, summary.Minimum, summary.Median,
            summary.Mean, summary.P95, summary.StandardDeviation);
    }

    void PrintRawSamples(std::string_view scenario, const TrialResults& results)
    {
        constexpr std::array<std::string_view, 3> ApproachNames = {
            "stateless", "hybrid", "stateful"
        };
        for (std::size_t approach = 0; approach < ApproachNames.size(); ++approach)
        {
            for (std::size_t trial = 0; trial < results.Samples[approach].size(); ++trial)
            {
                std::printf("sample,%.*s,%.*s,%zu,%zu,,,,,,,ns_per_tick,%.3f\n",
                    static_cast<int>(scenario.size()), scenario.data(),
                    static_cast<int>(ApproachNames[approach].size()),
                    ApproachNames[approach].data(), trial + 1,
                    IterationsPerTrial, results.Samples[approach][trial]);
            }
        }
    }

    const char* CompilerDescription()
    {
#if defined(__clang__)
        return "Clang " __clang_version__;
#elif defined(_MSC_VER)
        return "Microsoft Visual C++ " CAMERA_STRINGIZE(_MSC_VER);
#elif defined(__GNUC__)
        return "GCC " __VERSION__;
#else
        return "Unknown compiler";
#endif
    }

    const char* CpuDescription()
    {
        static char description[49] = "Unavailable";
#if defined(_WIN32) && (defined(_M_X64) || defined(_M_IX86))
        int registers[4] = {};
        __cpuid(registers, static_cast<int>(0x80000000u));
        if (static_cast<unsigned int>(registers[0]) >= 0x80000004u)
        {
            for (unsigned int leaf = 0; leaf < 3; ++leaf)
            {
                __cpuid(registers, static_cast<int>(0x80000002u + leaf));
                std::memcpy(description + leaf * 16, registers, 16);
            }
            description[48] = '\0';
        }
#endif
        return description;
    }
}

int main(int argumentCount, char** arguments)
{
    using namespace Benchmark;

    if (argumentCount == 3 && std::string_view(arguments[1]) == "--output")
    {
#if defined(_WIN32)
        FILE* outputFile = nullptr;
        const bool outputFailed = freopen_s(&outputFile, arguments[2], "w", stdout) != 0;
#else
        const bool outputFailed = std::freopen(arguments[2], "w", stdout) == nullptr;
#endif
        if (outputFailed)
        {
            std::fprintf(stderr, "Could not open benchmark output file.\n");
            return EXIT_FAILURE;
        }
    }
    else if (argumentCount != 1)
    {
        std::fprintf(stderr, "Usage: camera_benchmark.exe [--output PATH]\n");
        return EXIT_FAILURE;
    }

    if (!VerifyEquivalentResults())
    {
        std::fprintf(stderr, "Correctness verification failed.\n");
        return EXIT_FAILURE;
    }

    Entity target;
    target.Transform.Location = Vector3(100.0, 20.0, 50.0);

    GameManager hotManager;
    hotManager.ActiveEntity = &target;

    std::vector<GameManager> scatteredManagers(ManagerCount);
    for (GameManager& manager : scatteredManagers)
    {
        manager.ActiveEntity = &target;
    }

    const auto hotStateless = [&]() {
        return MeasureHot<CameraStateless>(target, hotManager, IterationsPerTrial,
            [](CameraStateless& camera, const GameManager& manager) {
                camera.Tick(DeltaTime, manager);
            });
        };
    const auto hotHybrid = [&]() {
        return MeasureHot<CameraHybrid>(target, hotManager, IterationsPerTrial,
            [](CameraHybrid& camera, const GameManager& manager) {
                camera.Tick(DeltaTime, manager);
            });
        };
    const auto hotStateful = [&]() {
        return MeasureHot<CameraStateful>(target, hotManager, IterationsPerTrial,
            [](CameraStateful& camera, const GameManager&) {
                camera.Tick(DeltaTime);
            });
        };

    const auto pressureStateless = [&]() {
        return MeasureCachePressure<CameraStateless>(target, scatteredManagers,
            IterationsPerTrial,
            [](CameraStateless& camera, const GameManager& manager) {
                camera.Tick(DeltaTime, manager);
            });
        };
    const auto pressureHybrid = [&]() {
        return MeasureCachePressure<CameraHybrid>(target, scatteredManagers,
            IterationsPerTrial,
            [](CameraHybrid& camera, const GameManager& manager) {
                camera.Tick(DeltaTime, manager);
            });
        };
    const auto pressureStateful = [&]() {
        return MeasureCachePressure<CameraStateful>(target, scatteredManagers,
            IterationsPerTrial,
            [](CameraStateful& camera, const GameManager&) {
                camera.Tick(DeltaTime);
            });
        };

    // Untimed warm-up faults in memory and allows the CPU to reach a stable state.
    MeasureHot<CameraStateless>(target, hotManager, WarmupIterations,
        [](CameraStateless& camera, const GameManager& manager) {
            camera.Tick(DeltaTime, manager);
        });
    MeasureCachePressure<CameraStateless>(target, scatteredManagers,
        WarmupIterations,
        [](CameraStateless& camera, const GameManager& manager) {
            camera.Tick(DeltaTime, manager);
        });

    const std::array<std::function<double()>, 6> runners = {
        hotStateless, hotHybrid, hotStateful,
        pressureStateless, pressureHybrid, pressureStateful
    };
    const auto allResults = CollectTrials(runners);
    const TrialResults& hotResults = allResults[0];
    const TrialResults& pressureResults = allResults[1];

    std::printf("record_type,scenario,approach,trial,iterations_per_trial,trials,min_ns,median_ns,mean_ns,p95_ns,stddev_ns,key,value\n");
    std::printf("metadata,,,,,,,,,,,verification,PASS\n");
    std::printf("metadata,,,,,,,,,,,cpu,%s\n", CpuDescription());
    std::printf("metadata,,,,,,,,,,,compiler,%s\n", CompilerDescription());
    std::printf("metadata,,,,,,,,,,,build,-std=c++20 -O2 -DNDEBUG\n");
    std::printf("metadata,,,,,,,,,,,sizeof_entity,%zu\n", sizeof(Entity));
    std::printf("metadata,,,,,,,,,,,sizeof_camera_stateless,%zu\n", sizeof(CameraStateless));
    std::printf("metadata,,,,,,,,,,,sizeof_camera_hybrid,%zu\n", sizeof(CameraHybrid));
    std::printf("metadata,,,,,,,,,,,sizeof_camera_stateful,%zu\n", sizeof(CameraStateful));
    std::printf("metadata,,,,,,,,,,,sizeof_game_manager,%zu\n", sizeof(GameManager));
    std::printf("metadata,,,,,,,,,,,cache_pressure_working_set_bytes,%zu\n",
        scatteredManagers.size() * sizeof(GameManager));
    PrintRow("hot", "stateless", hotResults.Summaries[0]);
    PrintRow("hot", "hybrid", hotResults.Summaries[1]);
    PrintRow("hot", "stateful", hotResults.Summaries[2]);
    PrintRow("cache_pressure", "stateless", pressureResults.Summaries[0]);
    PrintRow("cache_pressure", "hybrid", pressureResults.Summaries[1]);
    PrintRow("cache_pressure", "stateful", pressureResults.Summaries[2]);
    PrintRawSamples("hot", hotResults);
    PrintRawSamples("cache_pressure", pressureResults);
    std::printf("metadata,,,,,,,,,,,result_sink,%.6f\n", ResultSink);

    return EXIT_SUCCESS;
}
