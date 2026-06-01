import subprocess

from app.domain.system.dto.system_response import GpuInfo, GpuStatusResponse


class SystemService:
    def get_gpu_status(self) -> GpuStatusResponse:
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=index,name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode != 0:
                return GpuStatusResponse(available=False, gpu_count=0, error="nvidia-smi failed")

            gpus = []
            for line in result.stdout.strip().splitlines():
                parts = [p.strip() for p in line.split(",")]
                if len(parts) < 6:
                    continue
                gpus.append(
                    GpuInfo(
                        index=int(parts[0]),
                        name=parts[1],
                        memory_total_mb=int(parts[2]),
                        memory_used_mb=int(parts[3]),
                        memory_free_mb=int(parts[4]),
                        utilization_percent=int(parts[5]),
                        temperature_c=int(parts[6]) if len(parts) > 6 and parts[6].isdigit() else None,
                    )
                )

            return GpuStatusResponse(available=True, gpu_count=len(gpus), gpus=gpus)

        except FileNotFoundError:
            return GpuStatusResponse(available=False, gpu_count=0, error="nvidia-smi not found")
        except Exception as e:
            return GpuStatusResponse(available=False, gpu_count=0, error=str(e))
