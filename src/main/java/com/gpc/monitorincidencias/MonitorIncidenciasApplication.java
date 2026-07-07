package com.gpc.monitorincidencias;

import com.gpc.monitorincidencias.config.JiraProperties;
import com.gpc.monitorincidencias.config.MonitorProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({JiraProperties.class, MonitorProperties.class})
public class MonitorIncidenciasApplication {

	public static void main(String[] args) {
		SpringApplication.run(MonitorIncidenciasApplication.class, args);
	}

}
